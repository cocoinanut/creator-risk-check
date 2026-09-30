import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";
const code = ts.transpileModule(
  readFileSync(new URL("../lib/demo-data.ts", import.meta.url), "utf8"),
  {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  },
).outputText;
const {
  creators,
  scoring,
  resolveSearch,
  evidenceFor,
  dimensions,
  allEvidence,
} = await import(
  "data:text/javascript;base64," + Buffer.from(code).toString("base64")
);
test("权重、基础计算、风险分级与严重触发保持一致", () => {
  assert.equal(
    dimensions.reduce((n, d) => n + d.weight, 0),
    100,
  );
  assert.deepEqual(
    creators.map((c) => scoring(c)),
    [
      { base: 17.6, score: 18, adjustment: 0, level: "低" },
      { base: 44.55, score: 45, adjustment: 0, level: "中" },
      { base: 75.1, score: 85, adjustment: 9.9, level: "高" },
    ],
  );
  assert.deepEqual(
    creators.map((c) => c.decision),
    ["可进入候选", "需人工复核", "建议暂缓"],
  );
});
test("真实名字、伪装域名、视频链接不会匹配虚构人物", () => {
  for (const q of [
    "Taylor Swift",
    "@real.person",
    "https://instagram.com/taylorswift",
    "https://instagram.com.evil.test/lin.notes.demo",
    "https://youtube.com/watch?v=lin.notes.demo",
    "https://tiktok.com/@aran.outdoor.demo/video/123",
    "https://instagram.com/p/lin.notes.demo",
    "",
  ])
    assert.equal(resolveSearch(q).matches.length, 0, q);
});
test("名字、ID、规范主页解析且保留平台确认", () => {
  assert.equal(resolveSearch("林间").matches[0].id, "lin");
  assert.equal(resolveSearch("@weekend.lab.demo").matches[0].id, "zhou");
  assert.equal(
    resolveSearch("https://www.youtube.com/@aran.outdoor.demo/").platform,
    "YouTube",
  );
  assert.equal(
    resolveSearch("instagram.com/lin.notes.demo/").matches[0].id,
    "lin",
  );
  // A requested unsupported account still requires the UI's identity guard, never auto-scores.
  assert.equal(
    resolveSearch("https://tiktok.com/@lin.notes.demo").platform,
    "TikTok",
  );
  assert.ok(!creators[0].platforms.includes("TikTok"));
});
test("事件引用均可解析、记录有来源日期与局限，证据 ID 唯一", () => {
  assert.equal(new Set(allEvidence.map((e) => e.id)).size, allEvidence.length);
  for (const c of creators) {
    const keys = c.raw.map((r) => r[0]);
    for (const event of c.events)
      for (const key of event.evidence)
        assert.ok(keys.includes(key), c.id + ":" + key);
    for (const e of evidenceFor(c))
      assert.ok(e.date && e.publisher && e.excerpt && e.supports && e.limits);
  }
});
test("旧事件与缺失资料策略有覆盖", () => {
  assert.equal(creators[0].events.filter((e) => e.historical).length, 1);
  assert.ok(
    creators[1].events.some((e) => e.date < "2023-09-29" && !e.historical),
  );
  assert.ok(
    creators[2].events.some((e) => e.date < "2023-09-29" && !e.historical),
  );
  assert.deepEqual(creators[1].provisional, [4]);
  assert.equal(
    creators[2].events.find((e) => e.status === "单方指称").evidence[0],
    "allegation",
  );
});
