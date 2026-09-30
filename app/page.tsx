"use client";
import { useEffect, useState } from "react";
import { LanguagePicker, Localized, useLanguage } from "@/lib/i18n/language";
import {
  Search,
  ShieldCheck,
  LockKeyhole,
  ScanLine,
  Check,
  ChevronRight,
  ChevronDown,
  ExternalLink,
  FileText,
  Info,
  Layers,
  CheckCheck,
  ArrowLeft,
  AlertTriangle,
  Activity,
  Globe,
  Users,
  MessageSquare,
  Scale,
  BookmarkCheck,
  X,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
  SheetClose,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  creators,
  dimensions,
  evidenceFor,
  scoring,
  resolveSearch,
  AS_OF,
  type Creator,
} from "@/lib/demo-data";
type Review = {
  checked: boolean[];
  notes: string[];
  decision: string;
  reason: string;
  updated: string;
};
const freshReview = (): Review => ({
  checked: [false, false, false],
  notes: ["", "", ""],
  decision: "保留 AI 建议",
  reason: "",
  updated: "",
});
const nav = [
  ["overview", "评估概览"],
  ["dimensions", "风险维度"],
  ["profile", "创作者画像"],
  ["events", "声誉与历史"],
  ["content", "内容与商业"],
  ["review", "人工核查"],
];
export default function Home() {
  const { language } = useLanguage();
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Creator | null>(null);
  const [searchResult, setSearchResult] = useState<ReturnType<
    typeof resolveSearch
  > | null>(null);
  const [notice, setNotice] = useState("");
  const [drawer, setDrawer] = useState<{
    title: string;
    keys: string[];
    score?: boolean;
  } | null>(null);
  const [reviews, setReviews] = useState<Record<string, Review>>({});
  const [storageOK, setStorageOK] = useState(true);
  const [ready, setReady] = useState(false);
  const [activeSection, setActiveSection] = useState("overview");
  useEffect(() => {
    try {
      const saved = JSON.parse(
        localStorage.getItem("creator-risk-reviews-v1") || "{}",
      );
      if (saved && typeof saved === "object") {
        const valid: Record<string, Review> = {};
        for (const c of creators) {
          const r = saved[c.id];
          if (
            r &&
            Array.isArray(r.checked) &&
            r.checked.length === 3 &&
            r.checked.every((v: unknown) => typeof v === "boolean") &&
            Array.isArray(r.notes) &&
            r.notes.length === 3 &&
            r.notes.every((v: unknown) => typeof v === "string") &&
            typeof r.decision === "string" &&
            typeof r.reason === "string" &&
            typeof r.updated === "string"
          )
            valid[c.id] = r;
        }
        setReviews(valid);
      }
    } catch {
      setStorageOK(false);
    }
    setReady(true);
  }, []);
  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem("creator-risk-reviews-v1", JSON.stringify(reviews));
    } catch {
      setStorageOK(false);
    }
  }, [reviews, ready]);
  useEffect(() => {
    if (!selected) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) setActiveSection(e.target.id);
        });
      },
      { rootMargin: "-140px 0px -55% 0px" },
    );
    nav.forEach(([id]) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [selected]);
  const openCase = (c: Creator) => {
    setSelected(c);
    setSearchResult(null);
    setNotice("");
    setQ("");
    setDrawer(null);
    setActiveSection("overview");
    window.scrollTo({ top: 0, behavior: "instant" });
  };
  useEffect(() => {
    const context = (document as any).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    Promise.resolve(
      context.registerTool(
        {
          name: "open_demo_creator",
          title: "打开虚构 Creator 案例",
          description: "仅打开内置演示案例，不进行真实检索或作出人工决定。",
          inputSchema: {
            type: "object",
            properties: {
              caseId: { type: "string", enum: ["lin", "zhou", "ran"] },
            },
            required: ["caseId"],
            additionalProperties: false,
          },
          annotations: { readOnlyHint: false, untrustedContentHint: false },
          execute: async (input: unknown) => {
            const id = (input as { caseId?: string })?.caseId;
            const c = creators.find((c) => c.id === id);
            if (!c) throw new Error("未知演示案例");
            openCase(c);
            await new Promise((r) =>
              requestAnimationFrame(() => requestAnimationFrame(r)),
            );
            return { caseId: c.id, demo: true, score: scoring(c).score };
          },
        },
        { signal: lifecycle.signal },
      ),
    ).catch(() => {});
    return () => lifecycle.abort();
  }, []);
  function search(e: React.FormEvent) {
    e.preventDefault();
    setSelected(null);
    setNotice("");
    setSearchResult(resolveSearch(q));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  const c = selected;
  const score = c ? scoring(c) : null;
  const review = c ? reviews[c.id] || freshReview() : freshReview();
  const completed = review.checked.filter(Boolean).length;
  function updateReview(update: Partial<Review>) {
    if (!c) return;
    setReviews((prev) => ({
      ...prev,
      [c.id]: {
        ...(prev[c.id] || freshReview()),
        ...update,
        updated: new Date().toLocaleString("zh-CN"),
      },
    }));
  }
  const evidence = (title: string, keys: readonly string[]) =>
    setDrawer({ title, keys: [...keys] });
  const evButton = (
    title: string,
    keys: readonly string[],
    label = "查看证据",
  ) => (
    <button className="evidence-btn" onClick={() => evidence(title, keys)}>
      <FileText size={13} />
      {label}
    </button>
  );
  const searchForm = (
    <form className={"searchbox " + (c ? "compact" : "")} onSubmit={search}>
      <Search size={21} />
      <input
        aria-label="搜索 creator"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={
          c ? "搜索下一个 creator" : "输入 creator 名字、@ID 或社交平台主页链接"
        }
      />
      <button className="primary" type="submit">
        {c ? "搜索" : "开始评估"}
      </button>
    </form>
  );
  return (
    <Localized>
      <div className="shell">
        <header className="topbar">
          <a
            className="brand"
            href="/"
            onClick={(e) => {
              e.preventDefault();
              setSelected(null);
              setSearchResult(null);
              setQ("");
            }}
          >
            <span className="brandmark">
              <ScanLine size={24} />
            </span>
            Creator Risk Check<span className="demo-tag">演示工作台</span>
          </a>
          <div className="mode">
            <LanguagePicker />
            <span>DEMO</span>
            <a
              href="/live"
              className="live"
              title={
                language === "en" ? "Search public sources" : "检索真实公开资料"
              }
            >
              <Globe size={13} />{" "}
              {language === "en" ? "Live research" : "真实资料检索"}
            </a>
          </div>
        </header>
        {!c ? (
          <main className="landing">
            <div className="eyebrow">
              <ShieldCheck size={17} /> 合作之前，多一层判断
            </div>
            <h1>
              看见创作价值。
              <br />
              <span>也看清合作风险。</span>
            </h1>
            <p>从一个账号开始，了解风险、合作潜力与下一步。</p>
            {searchForm}
            <a
              href="/live"
              style={{
                display: "inline-block",
                marginTop: 14,
                fontSize: 13,
                color: "#146656",
                textDecoration: "underline",
              }}
            >
              {language === "en"
                ? "Looking up a real creator? Open Live research →"
                : "想查真实 creator？进入真实资料检索 →"}
            </a>
            <div className="search-hint">
              支持 TikTok、Instagram、YouTube · 无需品牌名称或 campaign brief
            </div>
            {searchResult && (
              <section className="search-results" aria-live="polite">
                <h2>
                  {searchResult.error
                    ? "无法评分"
                    : "先确认，这是你要找的账号吗？"}
                </h2>
                {searchResult.error ? (
                  <p>{searchResult.error}</p>
                ) : (
                  <>
                    <p>
                      身份确认前不生成分数。跨平台合并仅依据案例中的主页互链与本人声明。
                    </p>
                    {searchResult.matches.flatMap((m) => {
                      const platforms = searchResult.platform
                        ? [searchResult.platform]
                        : q.trim().startsWith("@")
                          ? [...m.platforms]
                          : [m.platforms[0]];
                      return platforms.map((p) => (
                        <div className="candidate" key={m.id + p}>
                          <span className={"avatar a" + m.color}>
                            {m.initial}
                          </span>
                          <div>
                            <strong>
                              {m.name}{" "}
                              <span className="demo-tag">演示数据</span>
                            </strong>
                            <p>
                              {p} · @{m.handle}
                            </p>
                            <small>
                              {(m.platforms as readonly string[]).includes(p)
                                ? "账号归属证据可用；确认后查看演示报告"
                                : "没有该平台归属证据；不可合并或评分"}
                            </small>
                          </div>
                          <button
                            className="primary"
                            onClick={() => {
                              if (
                                (m.platforms as readonly string[]).includes(p)
                              )
                                openCase(m);
                              else
                                setNotice(
                                  "身份无法确认，已停止评分。请选择有归属证据的账号。",
                                );
                            }}
                          >
                            确认账号
                          </button>
                        </div>
                      ));
                    })}
                    {!q.trim().startsWith("@") && !searchResult.platform && (
                      <div className="candidate ambiguous">
                        <span className="avatar">?</span>
                        <div>
                          <strong>
                            {searchResult.matches[0].name} · 同名未核实账号
                          </strong>
                          <p>TikTok · @unverified.name.demo</p>
                          <small>
                            虚构歧义候选 · 无互链或本人声明，不与其他账号合并
                          </small>
                        </div>
                        <button
                          className="secondary"
                          onClick={() =>
                            setNotice(
                              "所选账号身份无法确认，无法评分。请返回并选择已确认账号。",
                            )
                          }
                        >
                          选择此账号
                        </button>
                      </div>
                    )}
                  </>
                )}
                {notice && (
                  <p role="alert" className="error-note">
                    {notice}
                  </p>
                )}
              </section>
            )}
            <div className="demo-intro">
              <span>先体验一个虚构案例</span>
              <span>所有人物与证据均为演示数据</span>
            </div>
            <div className="case-grid">
              {creators.map((x) => (
                <button className="case" key={x.id} onClick={() => openCase(x)}>
                  <span className={"avatar a" + x.color}>{x.initial}</span>
                  <strong>{x.name}</strong>
                  <span className="muted">
                    {x.topics.slice(0, 2).join(" · ")}
                  </span>
                  <span className={"pill tone" + x.color}>
                    {scoring(x).level}风险案例
                  </span>
                </button>
              ))}
            </div>
            <p className="privacy">
              <LockKeyhole size={14} />{" "}
              当前为演示模式，输入不会触发真实人物检索。
            </p>
          </main>
        ) : (
          <>
            <div className="workspace-bar">
              <div className="breadcrumb">
                <button
                  onClick={() => {
                    setSelected(null);
                    setQ("");
                  }}
                >
                  <ArrowLeft size={15} /> 新建评估
                </button>
                <span>/</span>
                <span>Creator 评估报告</span>
              </div>
              <div className="workspace-tools">
                <Select
                  value={c.id}
                  onValueChange={(id) => {
                    const next = creators.find((x) => x.id === id);
                    if (next) openCase(next);
                  }}
                >
                  <SelectTrigger
                    aria-label="切换演示案例"
                    className="case-select"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {creators.map((x) => (
                      <SelectItem key={x.id} value={x.id}>
                        {x.name} · {scoring(x).level}风险
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {searchForm}
              </div>
            </div>
            <div className="demo-banner">
              <Info size={15} />
              <strong>演示数据</strong>
              <span>
                人物、账号、事件与来源均为完全虚构。此页面展示审核流程，不构成真实人物评价。
              </span>
            </div>
            <main className="report">
              <section id="overview" className="risk-card">
                <div className="creator-intro">
                  <div className="section-kicker">
                    CREATOR RISK CARD <span>01 / 合作前评估</span>
                  </div>
                  <div className="creator-identity">
                    <span
                      className={"avatar large a" + c.color}
                      aria-label="演示文字头像"
                    >
                      {c.initial}
                    </span>
                    <div>
                      <h1>{c.name}</h1>
                      <p>{c.role}</p>
                      <div className="accounts">
                        {c.platforms.map((p) => (
                          <button
                            key={p}
                            onClick={() =>
                              evidence("账号身份与合并依据", ["identity"])
                            }
                          >
                            <ShieldCheck size={13} />
                            {p}
                            <span>@{c.handle}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="risk-conclusion">
                    <span className="analysis-label">AI 分析</span>
                    <h2>{c.conclusion}</h2>
                  </div>
                  <div className="signals">
                    {c.signals.map((s, i) => (
                      <button
                        key={s}
                        onClick={() =>
                          i === 2 && c.floor
                            ? setDrawer({
                                title: "评分依据与重点风险规则",
                                keys: [],
                                score: true,
                              })
                            : evidence(
                                "关键合作信号",
                                c.id === "lin"
                                  ? [
                                      i === 0
                                        ? "content"
                                        : i === 1
                                          ? "history"
                                          : "commercial",
                                    ]
                                  : c.id === "zhou"
                                    ? i === 0
                                      ? ["commercial", "history"]
                                      : i === 1
                                        ? ["response"]
                                        : ["identity", "activity"]
                                    : i === 0
                                      ? ["content", "news"]
                                      : ["history", "comments"],
                              )
                        }
                      >
                        <span>0{i + 1}</span>
                        {s}
                        <ChevronRight size={14} />
                      </button>
                    ))}
                  </div>
                </div>
                <div className={"risk-score risk" + c.color}>
                  <div className="score-heading">
                    综合风险分数{" "}
                    <span className={"pill tone" + c.color}>
                      {score!.level}风险
                    </span>
                  </div>
                  <div className="score-number">
                    {score!.score}
                    <span>/ 100</span>
                  </div>
                  <div className="score-track">
                    <i style={{ left: score!.score + "%" }} />
                  </div>
                  <div className="score-scale">
                    <span>0 低</span>
                    <span>30 中</span>
                    <span>60 高</span>
                    <span>100</span>
                  </div>
                  <p>分数越高，合作风险越高</p>
                  <button
                    className="score-method"
                    onClick={() =>
                      setDrawer({
                        title: "评分依据与重点风险规则",
                        keys: [],
                        score: true,
                      })
                    }
                  >
                    查看评分依据 <ChevronRight size={13} />
                  </button>
                  <div className="confidence">
                    <ShieldCheck size={15} /> 证据充分度{" "}
                    <strong>{c.confidence}</strong>
                    {c.provisional.length > 0 && <span>部分暂定</span>}
                  </div>
                  <small>演示检索截至 {AS_OF}</small>
                </div>
              </section>
              <nav className="report-nav" aria-label="报告章节">
                {nav.map(([id, title]) => (
                  <a
                    key={id}
                    className={activeSection === id ? "active" : ""}
                    href={"#" + id}
                    onClick={() => setActiveSection(id)}
                  >
                    {title}
                    {id === "review" && <span>3</span>}
                  </a>
                ))}
              </nav>
              <div className="overview-grid">
                <section className="panel decision-panel">
                  <div className="panel-heading">
                    <div>
                      <div className="section-kicker">
                        COLLABORATION OUTLOOK
                      </div>
                      <h2>品牌合作判断</h2>
                    </div>
                    <span className={"pill tone" + c.color}>{c.decision}</span>
                  </div>
                  <div className="value-risk">
                    <div>
                      <div className="mini-heading">
                        <BookmarkCheck size={16} /> 合作价值{" "}
                        <span className="analysis-label">AI 分析</span>
                      </div>
                      <p>{c.value}</p>
                      {evButton("合作价值的内容依据", ["content", "activity"])}
                    </div>
                    <div>
                      <div className="mini-heading">
                        <AlertTriangle size={16} /> 可能承担的风险
                      </div>
                      <span className="future-label">未来可能情景</span>
                      <p>{c.risk}</p>
                      {evButton("风险情景的依据", [
                        "history",
                        c.id === "ran" ? "news" : "commercial",
                      ])}
                    </div>
                  </div>
                  <div className="category-grid">
                    <div>
                      <h3>较适合考虑</h3>
                      {c.fit.map(([name, why]) => (
                        <div className="category" key={name}>
                          <span className="category-dot" />
                          <div>
                            <strong>{name}</strong>
                            <p>{why}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div>
                      <h3>应提高审核级别</h3>
                      {c.caution.map(([name, why]) => (
                        <div className="category caution" key={name}>
                          <span className="category-dot" />
                          <div>
                            <strong>{name}</strong>
                            <p>{why}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="panel-note">
                    <Info size={14} />{" "}
                    通用品类条件建议；未评估具体品牌。品牌适配不计入风险分数。
                    {evButton(
                      "品类建议依据",
                      ["content", "commercial"],
                      "依据",
                    )}
                  </div>
                </section>
                <aside className="summary-side">
                  <section className="panel next-panel">
                    <div className="panel-heading">
                      <h2>下一步，先核查</h2>
                      <span className="count-label">{completed} / 3</span>
                    </div>
                    {c.checks.map((s, i) => (
                      <a href="#review" className="next-row" key={s}>
                        <span className={review.checked[i] ? "done" : ""}>
                          {review.checked[i] ? <Check size={13} /> : i + 1}
                        </span>
                        <p>{s}</p>
                        <ChevronRight size={14} />
                      </a>
                    ))}
                    <a className="review-link" href="#review">
                      进入人工核查 <CheckCheck size={15} />
                    </a>
                  </section>
                  <section className="panel gap-panel">
                    <h3>
                      <Info size={16} /> 判断的边界
                    </h3>
                    {c.gaps.map((s) => (
                      <p key={s}>{s}</p>
                    ))}
                    <small>资料不可得不等于零风险。</small>
                  </section>
                </aside>
              </div>
              <section className="panel coverage">
                <details>
                  <summary>
                    <div>
                      <Globe size={19} />
                      <h2>来源覆盖情况</h2>
                      <span className="coverage-count">
                        2 个已检查平台 · 1 个访问受限
                      </span>
                    </div>
                    <span>
                      查看覆盖与资料缺口 <ChevronDown size={15} />
                    </span>
                  </summary>
                  <div className="coverage-body">
                    <p>
                      以下为虚构案例预设的审核覆盖，当前没有执行网络搜索。重点窗口：2023-09-29
                      至
                      2026-09-29；另行保留重大历史事件。演示查询时间：2026-09-29
                      09:30（UTC+8）。
                    </p>
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>来源范围</th>
                            <th>状态</th>
                            <th>范围与局限</th>
                          </tr>
                        </thead>
                        <tbody>
                          {c.platforms.map((p) => (
                            <tr key={p}>
                              <td>{p}</td>
                              <td>
                                <span className="pill tone0">
                                  已检查 · 模拟
                                </span>
                              </td>
                              <td>
                                本人内容、公开回应、主页互链；已删除与私密内容不可得
                              </td>
                            </tr>
                          ))}
                          <tr>
                            <td>
                              {c.platforms.includes("TikTok" as never)
                                ? "Instagram"
                                : "TikTok"}
                            </td>
                            <td>
                              <span className="pill tone1">
                                无法访问 · 模拟
                              </span>
                            </td>
                            <td>登录或访问限制；同名账号未合并</td>
                          </tr>
                          <tr>
                            <td>新闻与可核查来源</td>
                            <td>
                              {c.id === "ran"
                                ? "2 份模拟报道"
                                : "未纳入独立报道"}
                            </td>
                            <td>
                              {c.id === "ran"
                                ? "用于演示交叉验证；均非真实媒体网页"
                                : "未纳入不等于不存在报道"}
                            </td>
                          </tr>
                          <tr>
                            <td>公开讨论与评论</td>
                            <td>{c.sample} 条样本</td>
                            <td>
                              跨帖主题抽样，受排序与删除影响，不代表全网情绪
                            </td>
                          </tr>
                          <tr>
                            <td>历史商业合作</td>
                            <td>最近 30 条内容</td>
                            <td>
                              公开标注样本；合同、实际销售与未披露合作不可得
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    <p className="panel-note">
                      本报告仅覆盖列出的模拟材料，不能声称查遍全网。
                      {evButton(
                        "来源覆盖样本",
                        ["identity", "content", "comments", "commercial"],
                        "查看记录",
                      )}
                    </p>
                  </div>
                </details>
              </section>
              <section id="dimensions" className="panel">
                <div className="panel-heading">
                  <div>
                    <div className="section-kicker">RISK BREAKDOWN</div>
                    <h2>六项风险维度</h2>
                  </div>
                  <button
                    className="text-button"
                    onClick={() =>
                      setDrawer({
                        title: "评分依据与重点风险规则",
                        keys: [],
                        score: true,
                      })
                    }
                  >
                    加权模型与计分说明 <Info size={14} />
                  </button>
                </div>
                <div className="dimension-grid">
                  {dimensions.map((d, i) => {
                    const keys = [
                      ["content"],
                      ["history", c.id === "ran" ? "news" : "commercial"],
                      ["comments"],
                      ["commercial", ...(c.id === "ran" ? ["allegation"] : [])],
                      ["identity", "activity"],
                      ["activity"],
                    ][i];
                    return (
                      <div className="dimension" key={d.name}>
                        <div className="dim-title">
                          <h3>
                            {d.name}
                            <span>{d.weight}%</span>
                          </h3>
                          <strong>
                            {c.scores[i]}
                            <small>/100</small>
                          </strong>
                        </div>
                        <div className="dim-track">
                          <span
                            style={{ width: c.scores[i] + "%" }}
                            className={
                              "bar" +
                              (c.scores[i] < 30 ? 0 : c.scores[i] < 60 ? 1 : 2)
                            }
                          />
                        </div>
                        <p>{c.reasons[i]}</p>
                        <div className="dimension-foot">
                          {evButton(
                            d.name + "：评分证据",
                            keys,
                            keys.length + " 条证据",
                          )}
                          {(c.provisional as readonly number[]).includes(i) && (
                            <span className="pill tone1">
                              暂定分数 · 证据低
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="model-summary">
                  <Scale size={16} />
                  <span>
                    基础加权分 <strong>{score!.base}</strong>
                    {c.floor ? (
                      <>
                        {" "}
                        + 重点风险调整 <strong>
                          {score!.adjustment}
                        </strong> = <strong>{score!.score}</strong>
                      </>
                    ) : (
                      <>
                        ，四舍五入为 <strong>{score!.score}</strong>
                      </>
                    )}
                    。同一事件的跟评不重复放大。
                  </span>
                  <button
                    onClick={() =>
                      setDrawer({
                        title: "评分依据与重点风险规则",
                        keys: [],
                        score: true,
                      })
                    }
                  >
                    查看计算
                  </button>
                </div>
              </section>
              <section id="profile" className="panel">
                <div className="panel-heading">
                  <div>
                    <div className="section-kicker">CREATOR & AUDIENCE</div>
                    <h2>Creator 与受众画像</h2>
                  </div>
                  {evButton("创作者画像依据", [
                    "content",
                    "identity",
                    "comments",
                  ])}
                </div>
                <div className="profile-grid">
                  <div>
                    <div className="topic-tags">
                      {c.topics.map((t) => (
                        <span key={t}>{t}</span>
                      ))}
                    </div>
                    <dl>
                      <dt>表达风格</dt>
                      <dd>{c.style}</dd>
                      <dt>常用语言</dt>
                      <dd>{c.languages}</dd>
                      <dt>活跃平台</dt>
                      <dd>{c.platforms.join(" / ")}</dd>
                    </dl>
                  </div>
                  <div className="audience">
                    <div>
                      <span className="analysis-label">公开内容推测</span>
                      <p>{c.audience}</p>
                    </div>
                    <div>
                      <span className="opinion-label">评论样本观察</span>
                      <p>{c.interests}</p>
                    </div>
                    <div className="locked-data">
                      <LockKeyhole size={17} />
                      <div>
                        <strong>真实粉丝画像 · 尚未授权</strong>
                        <p>年龄、地域、性别、转化与受众真实性均不可确认。</p>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
              <section id="events" className="panel">
                <div className="panel-heading">
                  <div>
                    <div className="section-kicker">REPUTATION & HISTORY</div>
                    <h2>声誉风险与历史记录</h2>
                  </div>
                  <span className="muted meta">近期重点 + 重大历史</span>
                </div>
                <div className="legend">
                  <span className="fact-label">可核实事实</span>
                  <span className="allegation-label">公开指称</span>
                  <span className="opinion-label">评论意见</span>
                  <span className="analysis-label">AI 分析</span>
                  <span className="future-label">未来可能情景</span>
                </div>
                {c.events
                  .filter((e) => !("historical" in e && e.historical))
                  .map((event, i) => (
                    <EventCard
                      key={event.title}
                      event={event}
                      index={i}
                      onEvidence={evidence}
                    />
                  ))}
                {c.events.some((e) => "historical" in e && e.historical) && (
                  <details className="history-group">
                    <summary>
                      其他历史记录 · 较轻且已修正 <ChevronDown size={15} />
                    </summary>
                    {c.events
                      .filter((e) => "historical" in e && e.historical)
                      .map((event, i) => (
                        <EventCard
                          key={event.title}
                          event={event}
                          index={i}
                          onEvidence={evidence}
                        />
                      ))}
                  </details>
                )}
                <p className="panel-note">
                  旧事件按严重程度、重复性、解决状态和当前影响保留；公开指称与网友观点不等于已证实事实。
                </p>
              </section>
              <section id="content" className="panel">
                <div className="panel-heading">
                  <div>
                    <div className="section-kicker">
                      CONTENT & COMMERCIAL ACTIVITY
                    </div>
                    <h2>内容与商业合作</h2>
                  </div>
                  {evButton("商业内容抽样方法", ["commercial", "content"])}
                </div>
                <div className="content-grid">
                  {c.posts.map(([title, date, type], i) => (
                    <button
                      className="post-card"
                      key={title}
                      onClick={() =>
                        evidence(title, [
                          i === 1
                            ? "commercial"
                            : i === 2 && c.id !== "lin"
                              ? "response"
                              : "content",
                        ])
                      }
                    >
                      <div className={"post-visual post" + c.color}>
                        <span>DEMO / {String(i + 1).padStart(2, "0")}</span>
                        {i === 0 ? (
                          <Layers size={32} />
                        ) : i === 1 ? (
                          <ScanLine size={32} />
                        ) : (
                          <MessageSquare size={32} />
                        )}
                        <small>虚构内容记录</small>
                      </div>
                      <div className="post-info">
                        <small>{date}</small>
                        <h3>{title}</h3>
                        <p>{type}</p>
                        <span>
                          查看内容依据 <FileText size={13} />
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
                <div className="commercial-summary">
                  <div>
                    <strong>
                      {c.density}
                      <span> / 30</span>
                    </strong>
                    <p>最近 30 条中的公开商业内容</p>
                  </div>
                  <div>
                    <h3>公开可见的合作品类</h3>
                    <p>{c.collabs}</p>
                    <small>
                      样本密度 {Math.round((c.density / 30) * 100)}
                      %；不推断全量合作、收入或未披露关系。
                    </small>
                  </div>
                  <div>
                    <h3>值得核查的表达</h3>
                    <p>
                      {c.id === "lin"
                        ? "第三方图样与“长期使用”表述的依据"
                        : c.id === "zhou"
                          ? "“最佳”“续航更强”等结论是否限定测试条件"
                          : "危险动作的安全说明是否充分，是否可被模仿"}
                    </p>
                    {evButton("历史表达核查", ["content", "history"])}
                  </div>
                </div>
              </section>
              <section id="review" className="panel review-panel">
                <div className="panel-heading">
                  <div>
                    <div className="section-kicker">HUMAN REVIEW</div>
                    <h2>人工核查清单</h2>
                    <p className="muted meta">
                      最终合作决定由人作出；修改不会覆盖原始 AI 评分。
                    </p>
                  </div>
                  <span className="pill neutral">{completed} / 3 已核查</span>
                </div>
                {c.checks.map((item, i) => (
                  <div className="review-item" key={item}>
                    <div className="check-title">
                      <Checkbox
                        id={"check-" + i}
                        checked={review.checked[i]}
                        onCheckedChange={(value) => {
                          const checked = [...review.checked];
                          checked[i] = value === true;
                          updateReview({ checked });
                        }}
                      />
                      <label htmlFor={"check-" + i}>{item}</label>
                      {evButton(
                        "人工核查 " + (i + 1),
                        i === 0
                          ? [
                              c.id === "ran"
                                ? "news"
                                : c.id === "zhou"
                                  ? "commercial"
                                  : "history",
                            ]
                          : i === 1
                            ? [
                                c.id === "ran"
                                  ? "history"
                                  : c.id === "zhou"
                                    ? "content"
                                    : "commercial",
                              ]
                            : [
                                "identity",
                                "activity",
                                ...(c.id === "ran" ? ["allegation"] : []),
                              ],
                        "打开证据",
                      )}
                    </div>
                    <textarea
                      aria-label={"第" + (i + 1) + "项审核备注"}
                      placeholder="填写核查结果、补充材料或仍待解决的问题…"
                      rows={2}
                      value={review.notes[i]}
                      onChange={(e) => {
                        const notes = [...review.notes];
                        notes[i] = e.target.value;
                        updateReview({ notes });
                      }}
                    />
                  </div>
                ))}
                <div className="human-decision">
                  <div>
                    <h3>人工合作判断</h3>
                    <p>
                      AI 建议：<strong>{c.decision}</strong>
                    </p>
                    <Select
                      value={review.decision}
                      onValueChange={(decision) => updateReview({ decision })}
                    >
                      <SelectTrigger
                        aria-label="修改 AI 判断"
                        className="decision-select"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[
                          "保留 AI 建议",
                          "可进入候选",
                          "需人工复核",
                          "建议暂缓",
                        ].map((d) => (
                          <SelectItem key={d} value={d}>
                            {d}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label htmlFor="decision-reason">改判理由 / 审核备注</label>
                    <textarea
                      id="decision-reason"
                      placeholder="记录你的判断理由。缺少关键资料时，请保留复核事项。"
                      rows={3}
                      value={review.reason}
                      onChange={(e) => updateReview({ reason: e.target.value })}
                    />
                    {review.decision !== "保留 AI 建议" &&
                      !review.reason.trim() && (
                        <small className="error-note">
                          人工改判为草稿，请补充理由后作为最终判断使用。
                        </small>
                      )}
                  </div>
                </div>
                <div className="save-state" role="status">
                  <CheckCheck size={15} />
                  {storageOK
                    ? "自动保存在当前浏览器；三个案例分别记录。"
                    : "浏览器存储不可用，本次修改仅保留到页面关闭。"}
                  {review.updated && <span>最近修改 {review.updated}</span>}
                </div>
              </section>
              <div className="report-end">
                <ShieldCheck size={20} />
                <p>判断有依据，决定有边界。</p>
                <span>演示报告 · {AS_OF} · 不构成具体品牌合作结论</span>
              </div>
            </main>
          </>
        )}
        <footer>
          Creator Risk Check <span>以证据辅助判断 · 最终决定由人作出</span>
        </footer>
        <Sheet
          open={!!drawer}
          onOpenChange={(open) => {
            if (!open) setDrawer(null);
          }}
        >
          <SheetContent className="evidence-sheet" showCloseButton={false}>
            <SheetClose className="drawer-close" aria-label="关闭证据抽屉">
              <X size={19} />
            </SheetClose>
            <div className="drawer-header">
              <span className="section-kicker">EVIDENCE ROOM</span>
              <SheetTitle>{drawer?.title}</SheetTitle>
              <SheetDescription>
                演示数据 · 来源与摘录完全虚构，不链接至真实人物页面。
              </SheetDescription>
            </div>
            {c &&
              drawer &&
              (drawer.score ? (
                <div className="drawer-body">
                  <div className="score-formula">
                    <span>最终风险分数</span>
                    <strong>
                      {score!.score}
                      <small>/100</small>
                    </strong>
                    <p>风险等级：0–29 低 / 30–59 中 / 60–100 高</p>
                  </div>
                  <h3>基础加权计算</h3>
                  <table className="calc-table">
                    <thead>
                      <tr>
                        <th>维度</th>
                        <th>分数 × 权重</th>
                        <th>贡献</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dimensions.map((d, i) => (
                        <tr key={d.name}>
                          <td>{d.name}</td>
                          <td>
                            {c.scores[i]} × {d.weight}%
                          </td>
                          <td>{((c.scores[i] * d.weight) / 100).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p>
                    未取整基础分：<strong>{score!.base}</strong>
                    。无触发时四舍五入。
                  </p>
                  <div className="rule-block">
                    <h3>重点风险触发规则</h3>
                    <p>
                      原始内容与独立记录交叉支持的严重安全行为，且重复发生、尚无独立整改证据时，将综合分下限设为
                      85。
                    </p>
                    <p>
                      {c.floor
                        ? `本案例触发：基础 ${score!.base} → 85，调整 +${score!.adjustment} 分。`
                        : "本案例未触发重点风险规则，调整 0 分。"}
                    </p>
                    {c.floor > 0 &&
                      evButton("触发依据", [
                        "content",
                        "news",
                        "history",
                        "response",
                      ])}
                  </div>
                  <h3>证据到分数的映射</h3>
                  <p>
                    0–29：样本中信号少或轻度问题已修正；30–59：存在待核实或未完全解决的问题；60–100：持续、重复或严重的可观察信号。具体分数由演示分析员按严重性、重复性、解决状态与时效录入，属于可审阅判断，不是经过统计校准的预测概率。
                  </p>
                  <h3>去重与缺失处理</h3>
                  <p>
                    同一事件以事件 ID
                    聚合。争议维度承担事件严重性；社区维度只评估跨帖持续主题，同事件跟评不额外累加。单方指称不触发严重风险规则。
                  </p>
                  <p>
                    部分资料缺失：标记暂定分数与低证据充分度。身份、核心原始材料缺失：无法评分。缺失不记作零分。公开互动不能验证虚假粉丝。
                  </p>
                  <p>
                    充分度高：关键材料有原始内容与可追溯交叉支持；中：有原始内容但存在重要缺口；低：核心维度主要依靠有限或间接样本。高充分度仍不代表资料齐全。
                  </p>
                </div>
              ) : (
                <div className="drawer-body">
                  {evidenceFor(c)
                    .filter((e) =>
                      drawer.keys.includes(e.id.slice(c.id.length + 1)),
                    )
                    .map((e) => (
                      <article className="evidence-record" key={e.id}>
                        <div className="evidence-meta">
                          <span
                            className={
                              e.type === "可核实事实"
                                ? "fact-label"
                                : e.type === "公开指称"
                                  ? "allegation-label"
                                  : "opinion-label"
                            }
                          >
                            {e.type}
                          </span>
                          <span>{e.id.toUpperCase()}</span>
                        </div>
                        <h3>{e.title}</h3>
                        <p className="muted meta">
                          平台 / 发布者：{e.publisher}
                        </p>
                        <dl>
                          <dt>原始发布日期</dt>
                          <dd>{e.date}</dd>
                          <dt>本次查询日期</dt>
                          <dd>{AS_OF} · 模拟</dd>
                        </dl>
                        <blockquote>{e.excerpt}</blockquote>
                        <h4>支持什么判断</h4>
                        <p>{e.supports}</p>
                        <h4>局限与其他解释</h4>
                        <p>{e.limits}</p>
                        <a
                          href={"/evidence?id=" + e.id + "&lang=" + language}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="source-link"
                        >
                          打开演示原始记录 <ExternalLink size={14} />
                        </a>
                        <small>站内虚构证据页，不是外部真实来源。</small>
                      </article>
                    ))}
                  <div className="panel-note">
                    “可核实事实”指案例内部存在对应原始记录。全部内容仍为虚构演示。
                  </div>
                </div>
              ))}
          </SheetContent>
        </Sheet>
      </div>
    </Localized>
  );
}
function EventCard({
  event: e,
  index,
  onEvidence,
}: {
  event: any;
  index: number;
  onEvidence: (title: string, keys: string[]) => void;
}) {
  return (
    <Localized>
      <details className="event-card">
        <summary>
          <span className="event-index">
            {String(index + 1).padStart(2, "0")}
          </span>
          <div className="event-main">
            <div className="event-top">
              <span
                className={
                  e.status === "单方指称" ? "allegation-label" : "fact-label"
                }
              >
                {e.status}
              </span>
              <time>{e.date}</time>
            </div>
            <h3>{e.title}</h3>
            <p>{e.summary}</p>
            <div className="event-state">
              <span>{e.state}</span>
              <span>
                展开事件详情 <ChevronDown size={14} />
              </span>
            </div>
          </div>
        </summary>
        <div className="event-details">
          <div className="event-impact">
            <div>
              <span className="future-label">未来可能情景</span>
              <h4>合作可能受到的影响</h4>
              <p>{e.impact}</p>
            </div>
            <div>
              <span className="analysis-label">AI 分析</span>
              <h4>建议核查</h4>
              <p>{e.check}</p>
            </div>
          </div>
          <h4>Creator 回应与不同说法</h4>
          <p>{e.response}</p>
          <h4>事件经过与后续</h4>
          <ol>
            {e.timeline.map((t: string) => (
              <li key={t}>{t}</li>
            ))}
          </ol>
          <button
            className="evidence-btn"
            onClick={() => onEvidence(e.title, e.evidence)}
          >
            <FileText size={14} /> 原始内容、各方说法与来源 ·{" "}
            {e.evidence.length} 条记录
          </button>
        </div>
      </details>
    </Localized>
  );
}
