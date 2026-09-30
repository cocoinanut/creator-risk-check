import { env } from "cloudflare:workers";
import { InputError, retrieve } from "@/lib/live/search";
const headers = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
};
const budgets = new Map<string, { count: number; reset: number }>();
let gdeltNext = 0;
function key() {
  return (
    env as unknown as Record<string, string>
  ).BRAVE_SEARCH_API_KEY?.trim();
}
export async function GET() {
  return Response.json(
    {
      braveConfigured: Boolean(key()),
      providers: ["Wikipedia", "GDELT"],
      scoringAvailable: false,
    },
    { headers },
  );
}
export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin)
    return Response.json({ error: "invalid_origin" }, { status: 403, headers });
  if (!request.headers.get("content-type")?.includes("application/json"))
    return Response.json({ error: "invalid_query" }, { status: 415, headers });
  const now = Date.now();
  for (const [id, b] of budgets) if (b.reset < now) budgets.delete(id);
  const id =
    request.headers.get("oai-authenticated-user-id") ||
    request.headers.get("cf-connecting-ip") ||
    "local";
  const budget = budgets.get(id) || { count: 0, reset: now + 60000 };
  if (budget.count >= 8 || budgets.size > 1000)
    return Response.json(
      { error: "rate_limited" },
      { status: 429, headers: { ...headers, "Retry-After": "60" } },
    );
  budget.count++;
  budgets.set(id, budget);
  try {
    if (Number(request.headers.get("content-length")) > 4096)
      throw new InputError("invalid_query");
    const body = await request.text();
    if (body.length > 4096) throw new InputError("invalid_query");
    let data;
    try {
      data = JSON.parse(body);
    } catch {
      throw new InputError("invalid_query");
    }
    if (!data || !["discover", "report"].includes(data.action))
      throw new InputError("invalid_query");
    if (data.action === "report" && data.confirmed !== true)
      throw new InputError("identity_required");
    if (data.action === "report") {
      if (now < gdeltNext)
        return Response.json(
          { error: "rate_limited" },
          { status: 429, headers: { ...headers, "Retry-After": "6" } },
        );
      gdeltNext = now + 6000;
    }
    const result = await retrieve(data.action, data.query, data.platform, {
      braveKey: key(),
    });
    return Response.json(result, { headers });
  } catch (e) {
    return Response.json(
      { error: e instanceof InputError ? e.message : "request_failed" },
      { status: e instanceof InputError ? 400 : 502, headers },
    );
  }
}
