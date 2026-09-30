import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";
const code = ts.transpileModule(
  readFileSync(new URL("../lib/live/search.ts", import.meta.url), "utf8"),
  {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  },
).outputText;
const { parseQuery, profile, publicUrl, retrieve } = await import(
  "data:text/javascript;base64," + Buffer.from(code).toString("base64")
);
const ok = (data) =>
  new Response(JSON.stringify(data), {
    headers: { "Content-Type": "application/json" },
  });
const fixed = () => new Date("2026-09-30T03:00:00Z");
test("Live rejects spoofed hosts, private URLs, post URLs and injected search operators", () => {
  for (const s of [
    "https://youtube.com.evil.test/@person",
    "https://instagram.com/p/post",
    "https://tiktok.com/@person/video/3",
    "http://youtube.com/@person",
    "https://youtube.com:8443/@person",
    "https://user:pass@youtube.com/@person",
  ])
    assert.throws(() => parseQuery(s), s);
  for (const s of [
    "javascript:alert(1)",
    "https://127.0.0.1/a",
    "https://localhost/a",
    "https://a.internal/a",
    "https://[::1]/",
  ])
    assert.equal(publicUrl(s), null, s);
  for (const s of ["A OR B", "name site:evil.test", '"name"', ""])
    assert.throws(() => parseQuery(s));
});
test("@handle requires platform; profiles normalize without merging platforms", () => {
  assert.throws(() => parseQuery("@example"));
  assert.equal(
    parseQuery("@example", "YouTube").candidate.url,
    "https://youtube.com/@example",
  );
  assert.equal(
    parseQuery("@example", "Instagram").candidate.url,
    "https://instagram.com/example",
  );
  assert.notEqual(
    parseQuery("@example", "Instagram").candidate.id,
    parseQuery("@example", "YouTube").candidate.id,
  );
  assert.equal(
    profile("https://www.youtube.com/@example/?utm_source=test").url,
    "https://youtube.com/@example",
  );
});
test("Profile confirmation never pretends to fetch or verify an account", async () => {
  const r = await retrieve("discover", "https://youtube.com/@test", null, {
    fetcher: () => {
      throw Error("must not fetch");
    },
    now: fixed,
  });
  assert.equal(r.candidates.length, 1);
  assert.equal(r.sources.length, 0);
  assert.equal(r.coverage[0].status, "not_configured");
  assert.equal(r.score, null);
});
test("Real adapters preserve provenance, distinguish indexing dates, and deduplicate URLs", async () => {
  const urls = [];
  const r = await retrieve("report", "Example Person", null, {
    now: fixed,
    braveKey: "test-only-secret",
    fetcher: async (url, init) => {
      urls.push(String(url));
      if (String(url).includes("wikipedia"))
        return ok({
          pages: [
            {
              key: "Example_Person",
              title: "Example Person",
              excerpt: "Reference <b>snippet</b>",
            },
          ],
        });
      if (String(url).includes("brave")) {
        assert.equal(init.headers["X-Subscription-Token"], "test-only-secret");
        return ok({
          web: {
            results: [
              {
                url: "https://example.com/story?utm_source=test",
                title: "Source title",
                description: "<script>untrusted</script> snippet",
                page_age: "2025-02-01",
              },
              { url: "javascript:alert(1)", title: "Invalid" },
            ],
          },
        });
      }
      return ok({
        articles: [
          {
            url: "https://example.com/story",
            title: "Duplicate",
            seendate: "20260929T120000Z",
          },
        ],
      });
    },
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.coverage.length, 5);
  assert.equal(r.score, null);
  assert.equal(r.evidenceStrength, "low");
  assert.ok(
    r.sources.every(
      (s) => s.publishedAt === null && s.retrievedAt === fixed().toISOString(),
    ),
  );
  assert.equal(r.sources[1].indexedAt, "2026-09-29T12:00:00.000Z");
  const brave = urls.filter((u) => u.includes("brave")).map((u) => new URL(u));
  assert.equal(brave.length, 3);
  assert.equal(
    brave[0].searchParams.get("freshness"),
    "2023-09-30to2026-09-30",
  );
  assert.equal(brave[2].searchParams.has("freshness"), false);
  assert.ok(!JSON.stringify(r).includes("test-only-secret"));
});
test("Unavailable or unconfigured providers never turn into zero risk or demo sources", async () => {
  const r = await retrieve("report", "Real Person", null, {
    now: fixed,
    fetcher: async () => {
      throw new Error("network unavailable with sensitive debug data");
    },
  });
  assert.deepEqual(
    r.coverage.map((c) => c.status),
    ["unavailable", "not_configured", "unavailable"],
  );
  assert.equal(r.score, null);
  assert.equal(r.sources.length, 0);
  assert.equal(r.candidates.length, 0);
  assert.ok(!JSON.stringify(r).includes("sensitive debug"));
});
test("Partial outage keeps successful sources and flags provider rate limits", async () => {
  const r = await retrieve("report", "Example", null, {
    fetcher: async (url) =>
      String(url).includes("wikipedia")
        ? ok({ pages: [{ key: "Example", title: "Example" }] })
        : new Response("Please limit requests to one every 5 seconds"),
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.coverage.at(-1).error, "rate_limited");
  assert.equal(r.coverage[0].status, "checked");
  assert.equal(r.score, null);
});
test("No results is distinct from provider failure and never permits a score", async () => {
  const r = await retrieve("report", "Example", null, {
    fetcher: async (url) =>
      String(url).includes("wikipedia")
        ? ok({ pages: [] })
        : ok({ articles: [] }),
  });
  assert.equal(r.sources.length, 0);
  assert.equal(r.coverage.filter((c) => c.status === "checked").length, 2);
  assert.equal(r.score, null);
});
test("Profile candidate discovery rejects indexed videos and preserves separate same-name accounts", async () => {
  const r = await retrieve("discover", "Example", null, {
    braveKey: "test",
    fetcher: async (url) =>
      String(url).includes("wikipedia")
        ? ok({ pages: [] })
        : ok({
            web: {
              results: [
                { url: "https://youtube.com/@example", title: "Example" },
                { url: "https://instagram.com/example", title: "Example" },
                { url: "https://youtube.com/watch?v=1", title: "Example" },
              ],
            },
          }),
  });
  assert.equal(r.candidates.length, 2);
  assert.notEqual(r.candidates[0].id, r.candidates[1].id);
});
