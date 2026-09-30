"use client";
import { useEffect, useState } from "react";
import { LanguagePicker, Localized } from "@/lib/i18n/language";
import { allEvidence, AS_OF } from "@/lib/demo-data";
export default function EvidencePage() {
  const [id, setId] = useState<string | null>(null);
  useEffect(
    () => setId(new URLSearchParams(window.location.search).get("id") || ""),
    [],
  );
  const evidence = allEvidence.find((e) => e.id === id);
  return (
    <Localized>
      <main className="source-page">
        <div className="source-toolbar">
          <LanguagePicker />
        </div>
        <a href="/" className="text-button">
          Creator Risk Check / 返回工作台
        </a>
        <div className="demo-banner">
          <strong>演示数据 · 完全虚构</strong>
        </div>
        {id === null ? (
          <p>正在读取演示记录…</p>
        ) : !evidence ? (
          <>
            <h1>未找到演示证据</h1>
            <p>该记录不存在。不会为未知来源生成内容。</p>
          </>
        ) : (
          <article className="panel">
            <span className="section-kicker">
              FICTIONAL SOURCE RECORD / {evidence.id}
            </span>
            <h1>{evidence.title}</h1>
            <p className="muted">
              {evidence.publisher} · {evidence.type}
            </p>
            <dl>
              <dt>原始发布日期</dt>
              <dd>{evidence.date}</dd>
              <dt>演示查询日期</dt>
              <dd>{AS_OF}</dd>
            </dl>
            <h2>原始演示记录 / 内容概述</h2>
            <blockquote>{evidence.excerpt}</blockquote>
            <h2>这条证据支持什么</h2>
            <p>{evidence.supports}</p>
            <h2>局限与其他解释</h2>
            <p>{evidence.limits}</p>
            <div className="rule-block">
              这是为产品作品集编写的虚构证据记录。没有真实帖子、报道或真实
              creator
              与之对应；日期、发布者和事件均属案例设定。“可核实事实”仅指模拟审核中的证据类型。
            </div>
          </article>
        )}
      </main>
    </Localized>
  );
}
