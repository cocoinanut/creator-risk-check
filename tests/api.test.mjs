import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";
const source = readFileSync(new URL("../app/api/live/route.ts", import.meta.url), "utf8")
  .replace('import { env } from "cloudflare:workers";', 'const env = {};')
  .replace('import { InputError, retrieve } from "@/lib/live/search";',
    'class InputError extends Error {} async function retrieve() { return { score: null }; }');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
async function api() { return import("data:text/javascript;base64," + Buffer.from(js + `\n// ${Math.random()}`).toString("base64")); }
function request(body, extra = {}) { return new Request("https://demo.example/api/live", { method: "POST", headers: { "Content-Type": "application/json", ...extra }, body }); }
test("API rejects cross-origin requests and unconfirmed reports", async () => {
  const {POST} = await api();
  assert.equal((await POST(request('{}', {Origin: 'https://other.example'}))).status, 403);
  assert.equal((await POST(request('{"action":"report","query":"Person"}'))).status, 400);
});
test("API bounds chunked request bytes before parsing", async () => {
  const {POST} = await api(); let cancelled = false;
  const body = new ReadableStream({pull(c) { c.enqueue(new Uint8Array(4097)); }, cancel() { cancelled = true; }});
  const req = new Request("https://demo.example/api/live", {method: "POST", headers: {"Content-Type":"application/json"}, body, duplex: "half"});
  assert.equal((await POST(req)).status, 400);
  assert.equal(cancelled, true);
});
test("Caller-supplied user IDs cannot create new local rate-limit buckets", async () => {
  const {POST} = await api();
  for (let i=0;i<8;i++) assert.equal((await POST(request('{"action":"discover","query":"Person"}', {'oai-authenticated-user-id': String(i)}))).status, 200);
  assert.equal((await POST(request('{"action":"discover","query":"Person"}', {'oai-authenticated-user-id':'another'}))).status, 429);
});
