/** Server-only public-source retrieval. No user-supplied URL is fetched. */
export type Platform = "YouTube" | "Instagram" | "TikTok";
export type Candidate = {
  id: string;
  name: string;
  url: string;
  description: string;
  platform: string;
  kind: "profile" | "reference";
};
export type Source = {
  id: string;
  title: string;
  url: string;
  publisher: string;
  excerpt: string;
  publishedAt: string | null;
  indexedAt: string | null;
  retrievedAt: string;
  provider: string;
  scope: string;
};
export type Coverage = {
  provider: string;
  status: "checked" | "unavailable" | "not_configured";
  count: number;
  scope: string;
  error?: string;
};
export type LiveResult = {
  query: string;
  retrievedAt: string;
  candidates: Candidate[];
  sources: Source[];
  coverage: Coverage[];
  score: null;
  evidenceStrength: "low";
};
export type Config = {
  braveKey?: string;
  fetcher?: typeof fetch;
  now?: () => Date;
};
export class InputError extends Error {}
export function publicUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 2048) return null;
  try {
    const u = new URL(value);
    const h = u.hostname.toLowerCase();
    if (
      u.protocol !== "https:" ||
      u.username ||
      u.password ||
      u.port ||
      !h.includes(".") ||
      /(^localhost$|\.localhost$|\.local$|\.internal$|^[\d.]+$|:)/.test(h)
    )
      return null;
    u.hash = "";
    for (const k of [...u.searchParams.keys()])
      if (/^utm_|^(fbclid|gclid)$/.test(k)) u.searchParams.delete(k);
    return u.href;
  } catch {
    return null;
  }
}
export function profile(value: string): Candidate | null {
  const normalized = value.startsWith("https://") ? value : `https://${value}`;
  const safe = publicUrl(normalized);
  if (!safe) return null;
  const u = new URL(safe);
  const host = u.hostname.replace(/^www\./, "");
  const path = u.pathname.replace(/\/$/, "");
  let platform: Platform;
  let handle: string;
  if (host === "youtube.com" && /^\/@[\w.\-\p{L}\p{N}]{1,100}$/u.test(path)) {
    platform = "YouTube";
    handle = path.slice(1);
  } else if (host === "youtube.com" && /^\/channel\/UC[\w-]{22}$/.test(path)) {
    platform = "YouTube";
    handle = path.slice(9);
  } else if (
    host === "instagram.com" &&
    /^\/[\w.]{1,30}$/.test(path) &&
    !/^\/(p|reel|reels|stories|explore|accounts|direct|about|legal)$/i.test(
      path,
    )
  ) {
    platform = "Instagram";
    handle = `@${path.slice(1)}`;
  } else if (host === "tiktok.com" && /^\/@[\w.]{1,24}$/.test(path)) {
    platform = "TikTok";
    handle = path.slice(1);
  } else return null;
  const url = `https://${host}${path}`;
  return {
    id: url,
    name: handle,
    url,
    platform,
    description: "",
    kind: "profile",
  };
}
export function parseQuery(input: unknown, platform?: unknown) {
  if (typeof input !== "string") throw new InputError("invalid_query");
  const q = input.trim();
  if (q.length < 2 || q.length > 180 || /[\x00-\x1f]/.test(q))
    throw new InputError("invalid_query");
  if (/^(https?:\/\/|www\.|(?:youtube|instagram|tiktok)\.com)/i.test(q)) {
    const candidate = profile(q);
    if (!candidate) throw new InputError("invalid_profile");
    return { q: candidate.name, candidate };
  }
  if (q.startsWith("@")) {
    if (!["YouTube", "Instagram", "TikTok"].includes(String(platform)))
      throw new InputError("platform_required");
    const base =
      platform === "YouTube"
        ? "youtube.com/"
        : platform === "TikTok"
          ? "tiktok.com/"
          : "instagram.com/";
    const candidate = profile(
      base + (platform === "Instagram" ? q.slice(1) : q),
    );
    if (!candidate) throw new InputError("invalid_profile");
    return { q, candidate };
  }
  // Prevent search-operator injection; names and handles remain Unicode-friendly.
  if (/[<>"{}()[\]\\:|]/.test(q) || /\b(?:AND|OR|NOT)\b/.test(q))
    throw new InputError("invalid_query");
  return { q, candidate: null };
}
function plain(value: unknown, max = 650): string {
  return typeof value === "string"
    ? value
        .replace(/<[^>]*>/g, "")
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, "&")
        .replace(/&#39;/g, "'")
        .slice(0, max)
    : "";
}
function iso(value: unknown) {
  if (typeof value !== "string") return null;
  const v = /^\d{8}T\d{6}Z$/.test(value)
    ? value.replace(
        /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/,
        "$1-$2-$3T$4:$5:$6Z",
      )
    : value;
  return Number.isFinite(Date.parse(v)) ? new Date(v).toISOString() : null;
}
export async function retrieve(
  action: "discover" | "report",
  input: unknown,
  platform: unknown,
  config: Config = {},
): Promise<LiveResult> {
  const { q, candidate } = parseQuery(input, platform);
  const now = (config.now?.() ?? new Date()).toISOString();
  const result: LiveResult = {
    query: q,
    retrievedAt: now,
    candidates: [],
    sources: [],
    coverage: [],
    score: null,
    evidenceStrength: "low",
  };
  const fetcher = config.fetcher ?? fetch;
  const json = async (url: string, headers: Record<string, string> = {}) => {
    const response = await fetcher(url, {
      headers: { Accept: "application/json", ...headers },
      signal: AbortSignal.timeout(16000),
      redirect: "error",
    });
    if (!response.ok)
      throw new Error(
        response.status === 429
          ? "rate_limited"
          : response.status === 401 || response.status === 403
            ? "access_denied"
            : "provider_error",
      );
    const body = await response.text();
    if (body.length > 2000000) throw new Error("provider_error");
    try {
      return JSON.parse(body);
    } catch {
      throw new Error(
        /limit requests|rate limit/i.test(body)
          ? "rate_limited"
          : "provider_error",
      );
    }
  };
  const source = (
    raw: {
      url: unknown;
      title: unknown;
      excerpt?: unknown;
      publishedAt?: unknown;
      indexedAt?: unknown;
    },
    provider: string,
    scope: string,
  ) => {
    const url = publicUrl(raw.url);
    if (!url) return;
    result.sources.push({
      id: url,
      url,
      title: plain(raw.title, 240) || new URL(url).hostname,
      excerpt: plain(raw.excerpt),
      publisher: new URL(url).hostname,
      publishedAt: iso(raw.publishedAt),
      indexedAt: iso(raw.indexedAt),
      retrievedAt: now,
      provider,
      scope,
    });
  };
  const run = async (
    provider: string,
    scope: string,
    task: () => Promise<void>,
  ) => {
    const before = result.sources.length;
    try {
      await task();
      result.coverage.push({
        provider,
        scope,
        status: "checked",
        count: result.sources
          .slice(before)
          .filter((s) => s.provider === provider && s.scope === scope).length,
      });
    } catch (error) {
      result.coverage.push({
        provider,
        scope,
        status: "unavailable",
        count: 0,
        error:
          error instanceof Error &&
          ["rate_limited", "access_denied", "provider_error"].includes(
            error.message,
          )
            ? error.message
            : "connection_failed",
      });
    }
  };
  if (candidate && action === "discover") {
    result.candidates = [candidate];
    result.coverage.push({
      provider: candidate.platform,
      status: "not_configured",
      count: 0,
      scope: "profile_not_fetched",
    });
    return result;
  }
  const searchName = q.replace(/^@/, "");
  const locale = /[\u3400-\u9fff]/.test(searchName) ? "zh" : "en";
  await run("Wikipedia", "reference", async () => {
    const url = new URL(
      `https://${locale}.wikipedia.org/w/rest.php/v1/search/page`,
    );
    url.searchParams.set("q", searchName);
    url.searchParams.set("limit", action === "discover" ? "6" : "3");
    const data = await json(url.href, {
      "User-Agent": "CreatorRiskCheck/0.2 (public-source review prototype)",
    });
    if (!Array.isArray(data.pages)) throw new Error("provider_error");
    for (const p of data.pages) {
      if (typeof p.key !== "string" || typeof p.title !== "string") continue;
      const url = `https://${locale}.wikipedia.org/wiki/${encodeURIComponent(p.key)}`;
      source(
        { url, title: p.title, excerpt: p.excerpt },
        "Wikipedia",
        "reference",
      );
      if (action === "discover")
        result.candidates.push({
          id: url,
          name: plain(p.title, 180),
          url,
          description: plain(p.description || p.excerpt, 280),
          platform: "Wikipedia",
          kind: "reference",
        });
    }
  });
  if (config.braveKey) {
    const scopes =
      action === "discover" ? ["profiles"] : ["recent", "response", "history"];
    // Avoid parallel request bursts. Provider rate-limit errors remain visible.
    for (const scope of scopes)
      await run("Brave Search", scope, async () => {
        const url = new URL("https://api.search.brave.com/res/v1/web/search");
        const base = `"${searchName}"`;
        const suffix =
          scope === "profiles"
            ? " (site:youtube.com OR site:instagram.com OR site:tiktok.com)"
            : scope === "response"
              ? locale === "zh"
                ? " 回应 声明"
                : " response statement"
              : "";
        url.searchParams.set("q", base + suffix);
        url.searchParams.set("count", "10");
        if (scope === "recent" || scope === "response") {
          const start = new Date(now);
          start.setUTCFullYear(start.getUTCFullYear() - 3);
          url.searchParams.set(
            "freshness",
            `${start.toISOString().slice(0, 10)}to${now.slice(0, 10)}`,
          );
        }
        const data = await json(url.href, {
          "X-Subscription-Token": config.braveKey!,
        });
        if (!data.web || !Array.isArray(data.web.results)) {
          if (data.type === "search") return;
          throw new Error("provider_error");
        }
        for (const p of data.web.results) {
          // Search dates can reflect updates, so never relabel them as original publication dates.
          source(
            {
              url: p.url,
              title: p.title,
              excerpt: p.description,
              indexedAt: p.page_age,
            },
            "Brave Search",
            scope,
          );
          if (action === "discover" && typeof p.url === "string") {
            const c = profile(p.url);
            if (c)
              result.candidates.push({
                ...c,
                name: plain(p.title, 180) || c.name,
                description: plain(p.description, 280),
              });
          }
        }
      });
  } else
    result.coverage.push({
      provider: "Brave Search",
      status: "not_configured",
      count: 0,
      scope: "web",
    });
  if (action === "report")
    await run("GDELT", "news_3months", async () => {
      const url = new URL("https://api.gdeltproject.org/api/v2/doc/doc");
      url.search = new URLSearchParams({
        query: `"${searchName.replace(/[^\p{L}\p{N} ._-]/gu, "")}"`,
        mode: "artlist",
        format: "json",
        maxrecords: "20",
        timespan: "3months",
        sort: "datedesc",
      }).toString();
      const data = await json(url.href);
      if (!Array.isArray(data.articles)) {
        if (Object.keys(data).length === 0) return;
        throw new Error("provider_error");
      }
      for (const p of data.articles)
        source(
          { url: p.url, title: p.title, indexedAt: p.seendate },
          "GDELT",
          "news_3months",
        );
    });
  result.sources = [...new Map(result.sources.map((s) => [s.url, s])).values()];
  result.candidates = [
    ...new Map(result.candidates.map((c) => [c.url, c])).values(),
  ];
  return result;
}
