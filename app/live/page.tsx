"use client";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Search,
  Globe,
  ExternalLink,
  FileText,
  ScanLine,
  Check,
  LoaderCircle,
  Download,
  X,
  Settings2,
} from "lucide-react";
import { LanguagePicker, useLanguage } from "@/lib/i18n/language";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
  SheetClose,
} from "@/components/ui/sheet";
import type { Candidate, LiveResult, Source } from "@/lib/live/search";
import "./live.css";
const scopes: Record<string, [string, string]> = {
  reference: [
    "百科参考资料；不等于身份认证",
    "Encyclopedia references; not identity verification",
  ],
  profiles: [
    "搜索引擎索引中的主页候选",
    "Profile candidates in the search index",
  ],
  recent: [
    "近三年索引日期筛选；不保证完整覆盖",
    "Index dates within three years; coverage is incomplete",
  ],
  response: [
    "近三年公开回应关键词搜索",
    "Public response queries within three years",
  ],
  history: [
    "不限制日期的历史补充检索",
    "Additional search without a date restriction",
  ],
  news_3months: [
    "最近三个月新闻索引，最多 20 条",
    "News index from the last three months, up to 20 items",
  ],
  web: ["网页搜索尚未配置", "Web search is not configured"],
  profile_not_fetched: [
    "仅解析主页链接，未获取平台资料",
    "Profile URL parsed; platform data not retrieved",
  ],
};
const errors: Record<string, [string, string]> = {
  invalid_query: [
    "请输入 2–180 个字符的名字、@ID 或平台主页。请不要使用搜索运算符。",
    "Enter a 2–180 character name, @handle or profile URL without search operators.",
  ],
  invalid_profile: [
    "请输入 TikTok、Instagram 或 YouTube 的 HTTPS 主页链接。暂不支持视频、帖子或其他网站链接。",
    "Use a TikTok, Instagram or YouTube HTTPS profile URL. Posts, videos and other sites are not supported.",
  ],
  platform_required: [
    "请输入 @ID 所属的平台。",
    "Choose the platform for this @handle.",
  ],
  identity_required: [
    "请先确认检索对象。",
    "Confirm the research subject first.",
  ],
  rate_limited: [
    "检索暂时受限，请稍后重试。",
    "Search is rate limited. Please try again later.",
  ],
  access_denied: [
    "数据源拒绝访问，请检查服务密钥或访问权限。",
    "Provider denied access. Check service credentials or access.",
  ],
  provider_error: [
    "数据源未返回有效资料。",
    "The provider did not return valid data.",
  ],
  connection_failed: [
    "无法连接数据源或连接超时。",
    "The provider could not be reached or timed out.",
  ],
  request_failed: [
    "本次检索失败，请稍后重试。",
    "Search failed. Please try again later.",
  ],
};
export default function LivePage() {
  const { language } = useLanguage();
  const t = (zh: string, en: string) => (language === "en" ? en : zh);
  const pair = (p?: [string, string]) => (p ? t(...p) : "");
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [query, setQuery] = useState("");
  const [platform, setPlatform] = useState("");
  const [result, setResult] = useState<LiveResult | null>(null);
  const [subject, setSubject] = useState<Candidate | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [drawer, setDrawer] = useState<Source | null>(null);
  const [filter, setFilter] = useState("all");
  const controller = useRef<AbortController | null>(null);
  useEffect(() => {
    fetch("/api/live")
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json() as Promise<{ braveConfigured: boolean }>;
      })
      .then((d) => setConfigured(d.braveConfigured))
      .catch(() => setConfigured(null));
    return () => controller.current?.abort();
  }, []);
  async function request(action: "discover" | "report", candidate?: Candidate) {
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    setBusy(action);
    setError("");
    setResult(null);
    setDrawer(null);
    setFilter("all");
    if (action === "discover") setSubject(null);
    else setSubject(candidate!);
    try {
      const response = await fetch("/api/live", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: abort.signal,
        body: JSON.stringify({
          action,
          query: candidate
            ? candidate.kind === "profile"
              ? candidate.url
              : candidate.name
            : query,
          platform,
          confirmed: action === "report",
        }),
      });
      const data = (await response.json()) as LiveResult & { error?: string };
      if (!response.ok) throw new Error(data.error || "request_failed");
      if (!abort.signal.aborted) setResult(data);
    } catch (e) {
      if (!abort.signal.aborted)
        setError(
          e instanceof Error && errors[e.message]
            ? e.message
            : "request_failed",
        );
    } finally {
      if (!abort.signal.aborted) setBusy("");
    }
  }
  const date = (s: string | null) =>
    s
      ? new Date(s).toLocaleString(language === "en" ? "en-GB" : "zh-CN", {
          timeZoneName: "short",
        })
      : t("未提供，需打开原文核查", "Not supplied; check the original");
  const list =
    result?.sources.filter((s) => filter === "all" || s.provider === filter) ||
    [];
  return (
    <div className="shell live-shell">
      <header className="topbar">
        <a className="brand" href="/">
          <span className="brandmark">
            <ScanLine size={24} />
          </span>
          Creator Risk Check
        </a>
        <div className="live-header-actions">
          <a href="/" className="live-back">
            <ArrowLeft size={15} /> {t("演示案例", "Demo cases")}
          </a>
          <LanguagePicker />
        </div>
      </header>
      <main className="live-main">
        <div className="live-heading">
          <div>
            <div className="live-kicker">
              <span /> LIVE · {t("公开资料研究", "PUBLIC SOURCE RESEARCH")}
            </div>
            <h1>{t("从真实来源开始。", "Start with real sources.")}</h1>
            <p>
              {t(
                "确认对象、查看证据，再作出合作判断。",
                "Confirm the subject. Review the evidence. Make the decision.",
              )}
            </p>
          </div>
          <span className="live-pill">
            {t(
              "研究预览版 · 不自动评分",
              "Research preview · no automated score",
            )}
          </span>
        </div>
        <form
          className="live-search"
          onSubmit={(e) => {
            e.preventDefault();
            request("discover");
          }}
        >
          <Search size={21} />
          <input
            aria-label={t("真实资料搜索", "Search public sources")}
            placeholder={t(
              "名字、@ID 或 TikTok / Instagram / YouTube 主页",
              "Name, @handle or TikTok / Instagram / YouTube profile",
            )}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            maxLength={180}
            required
            disabled={!!busy}
          />
          <button className="primary" disabled={!!busy}>
            {busy ? (
              <LoaderCircle className="live-spin" size={17} />
            ) : (
              <Search size={17} />
            )}{" "}
            {t("检索真实资料", "Search public sources")}
          </button>
        </form>
        {query.trim().startsWith("@") && (
          <label className="live-platform">
            {t("这个 @ID 属于哪个平台？", "Which platform is this @handle on?")}
            <select
              aria-label={t("账号平台", "Account platform")}
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
              disabled={!!busy}
            >
              <option value="">{t("请选择平台", "Choose platform")}</option>
              {["YouTube", "Instagram", "TikTok"].map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </label>
        )}
        <div className="live-source-note">
          <Globe size={15} />
          <span>
            {configured === true
              ? t(
                  "已配置网页搜索 · 同时尝试百科与新闻索引",
                  "Web search configured · encyclopedia and news indexes also queried",
                )
              : configured === false
                ? t(
                    "基础公开源：Wikipedia + GDELT · 网页搜索待配置",
                    "Basic public sources: Wikipedia + GDELT · web search not configured",
                  )
                : t(
                    "数据源配置状态暂不可用",
                    "Provider configuration status unavailable",
                  )}
          </span>
          <a href="#live-setup">{t("数据源设置", "Source setup")}</a>
        </div>
        {busy && (
          <section className="live-panel live-loading" aria-live="polite">
            <LoaderCircle className="live-spin" />
            <div>
              <h2>
                {busy === "discover"
                  ? t("正在查找可能的对象…", "Finding potential matches…")
                  : t("正在查询公开资料…", "Retrieving public sources…")}
              </h2>
              <p>
                {t(
                  "数据源可能需要约 20–90 秒。平台受限或超时会单独显示。",
                  "Providers may take 20–90 seconds. Restrictions and timeouts are reported separately.",
                )}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                controller.current?.abort();
                setBusy("");
                setSubject(null);
              }}
            >
              {t("取消", "Cancel")}
            </button>
          </section>
        )}
        {error && (
          <div className="live-error" role="alert">
            {pair(errors[error])}
            <button
              onClick={() =>
                request(subject ? "report" : "discover", subject || undefined)
              }
            >
              {t("重试", "Retry")}
            </button>
          </div>
        )}
        {result && !subject && (
          <section className="live-panel">
            <div className="live-section-head">
              <h2>{t("01 / 确认检索对象", "01 / Confirm the subject")}</h2>
              <span>
                {result.candidates.length} {t("个候选", "candidates")}
              </span>
            </div>
            <p className="live-muted">
              {t(
                "候选来自公开索引或你输入的链接，尚未核实账号归属。请打开来源确认；同名账号不会自动合并。百科条目也可能不是人物。",
                "Candidates come from public indexes or your URL. Account ownership is unverified. Open the source before choosing; namesakes are never merged. Encyclopedia matches may not be people.",
              )}
            </p>
            {!result.candidates.length && (
              <div className="live-empty">
                <h3>
                  {t("未找到可确认的候选", "No candidate could be confirmed")}
                </h3>
                <p>
                  {t(
                    "没有匹配不代表没有风险。可以输入准确的社交平台主页继续，或配置网页搜索扩大范围。",
                    "No match does not mean no risk. Try an exact social profile URL or configure web search for wider coverage.",
                  )}
                </p>
              </div>
            )}
            {result.candidates.map((c) => (
              <article className="live-candidate" key={c.id}>
                <div className="live-monogram">
                  {c.name.slice(0, 1).toUpperCase()}
                </div>
                <div>
                  <strong>{c.name}</strong>
                  <small>
                    {c.platform} ·{" "}
                    {c.kind === "profile"
                      ? t("待核实主页", "Unverified profile")
                      : t("参考条目", "Reference entry")}
                  </small>
                  <p>{c.description}</p>
                  <a href={c.url} target="_blank" rel="noopener noreferrer">
                    {t("打开来源确认", "Check source")}{" "}
                    <ExternalLink size={12} />
                  </a>
                </div>
                <button
                  className="primary"
                  onClick={() => request("report", c)}
                >
                  {t("选为检索对象", "Select subject")}
                </button>
              </article>
            ))}
          </section>
        )}
        {result && subject && (
          <>
            <section className="live-risk-card">
              <div>
                <div className="live-kicker">
                  {t(
                    "已选检索对象 · 账号归属待核实",
                    "SELECTED SUBJECT · OWNERSHIP UNVERIFIED",
                  )}
                </div>
                <h2>{subject.name}</h2>
                <a href={subject.url} target="_blank" rel="noopener noreferrer">
                  {subject.platform} <ExternalLink size={14} />
                </a>
                <p>
                  {t(
                    "需人工复核。当前仅检索到资料线索，尚不足以判断合作风险或推荐品牌品类。",
                    "Human review required. Retrieved leads are not sufficient to judge partnership risk or recommend brand categories.",
                  )}
                </p>
                <small>
                  {t("检索时间：", "Retrieved: ")}
                  {date(result.retrievedAt)}
                </small>
              </div>
              <div className="live-no-score">
                <strong>—</strong>
                <b>{t("无法评分", "Not scored")}</b>
                <span>{t("证据充分度：低", "Evidence sufficiency: low")}</span>
              </div>
            </section>
            <div className="live-stats">
              <div>
                <strong>{result.sources.length}</strong>
                <span>{t("条去重来源线索", "deduplicated source leads")}</span>
              </div>
              <div>
                <strong>
                  {result.coverage.filter((c) => c.status === "checked").length}
                </strong>
                <span>
                  {t("项查询成功返回", "queries returned successfully")}
                </span>
              </div>
              <div>
                <strong>0 / 6</strong>
                <span>
                  {t("个维度可自动评分", "dimensions ready for auto-scoring")}
                </span>
              </div>
            </div>
            <div className="live-columns">
              <section className="live-panel">
                <div className="live-section-head">
                  <h2>
                    {t(
                      "02 / 真实来源与证据线索",
                      "02 / Sources & evidence leads",
                    )}
                  </h2>
                  <select
                    aria-label={t("筛选来源", "Filter sources")}
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                  >
                    <option value="all">{t("全部来源", "All sources")}</option>
                    {[...new Set(result.sources.map((s) => s.provider))].map(
                      (p) => (
                        <option key={p}>{p}</option>
                      ),
                    )}
                  </select>
                </div>
                <p className="live-muted">
                  {t(
                    "以下为索引返回的原始标题和摘要，可能有同名误匹配。尚未阅读全文、核实指称或寻找完整回应，不能视为已证实事件。",
                    "These are original index titles and snippets, which may refer to namesakes. Full articles, allegations and responses have not been verified; these are not confirmed events.",
                  )}
                </p>
                {!list.length && (
                  <div className="live-empty">
                    {t(
                      "当前没有可展示的来源。请查看下方覆盖情况，或稍后重新检索。",
                      "No sources to display. Check coverage below or search again later.",
                    )}
                  </div>
                )}
                {list.map((s) => (
                  <article className="live-source" key={s.id}>
                    <div className="live-source-meta">
                      <span>{s.provider}</span>
                      <span>{s.publisher}</span>
                    </div>
                    <button
                      className="live-source-title"
                      onClick={() => setDrawer(s)}
                    >
                      {s.title}
                    </button>
                    <p>
                      {s.excerpt ||
                        t(
                          "该索引仅提供标题与链接，未提供正文摘录。",
                          "This index supplied a title and link without a content excerpt.",
                        )}
                    </p>
                    <div className="live-source-bottom">
                      <span>{t("待核查线索", "Unreviewed lead")}</span>
                      <button onClick={() => setDrawer(s)}>
                        <FileText size={14} />{" "}
                        {t("查看证据详情", "Evidence details")}
                      </button>
                    </div>
                  </article>
                ))}
              </section>
              <ReviewPanel key={subject.id} subject={subject} result={result} />
            </div>
          </>
        )}
        {result && (
          <section className="live-panel">
            <div className="live-section-head">
              <h2>{t("来源覆盖与资料缺口", "Source coverage & gaps")}</h2>
              <small>{date(result.retrievedAt)}</small>
            </div>
            <div className="live-coverage">
              {result.coverage.map((c, i) => (
                <div key={i}>
                  <strong>{c.provider}</strong>
                  <span className={"coverage-state " + c.status}>
                    {c.status === "checked"
                      ? t("已查询", "Queried")
                      : c.status === "unavailable"
                        ? t("未获取", "Unavailable")
                        : t("未配置", "Not configured")}
                  </span>
                  <p>{pair(scopes[c.scope])}</p>
                  <small>
                    {c.status === "checked"
                      ? `${c.count} ${t("条索引结果；不代表资料完整", "indexed results; not comprehensive")}`
                      : c.error
                        ? pair(errors[c.error])
                        : t(
                            "此次未获取该源资料",
                            "No data retrieved from this source",
                          )}
                  </small>
                </div>
              ))}
            </div>
            <div className="live-gap">
              <strong>{t("本次尚未覆盖", "Not covered in this search")}</strong>
              <p>
                {t(
                  "TikTok / Instagram / YouTube 平台内完整历史、视频画面及音频、已删除内容、评论样本、授权粉丝数据、商业合同与后台表现。仅有网页索引不等于已审核对应平台。新闻索引只查询近三个月；三年内容和重大旧事仍需补查。",
                  "Complete TikTok / Instagram / YouTube histories, video/audio, deleted content, comment samples, authorized audience data, contracts and private performance. Indexed pages do not constitute a platform audit. The news index queries only three months; three-year content and material older events still need review.",
                )}
              </p>
            </div>
          </section>
        )}
        {!result && !busy && !error && (
          <div className="live-intro">
            <div>
              <span>01</span>
              <h3>{t("确认人物", "Confirm identity")}</h3>
              <p>
                {t(
                  "名字先消歧，@ID 先选平台。",
                  "Disambiguate names and choose a platform for handles.",
                )}
              </p>
            </div>
            <div>
              <span>02</span>
              <h3>{t("查看真实来源", "Inspect real sources")}</h3>
              <p>
                {t(
                  "保留原始链接、查询日期和缺口。",
                  "Keep original links, retrieval dates and coverage gaps.",
                )}
              </p>
            </div>
            <div>
              <span>03</span>
              <h3>{t("留下审核依据", "Record your review")}</h3>
              <p>
                {t(
                  "核查原文与回应，再作人工判断。",
                  "Verify original material and responses before deciding.",
                )}
              </p>
            </div>
          </div>
        )}
        <details className="live-panel live-setup" id="live-setup">
          <summary>
            <Settings2 size={17} />{" "}
            {t("数据源设置与能力边界", "Source setup & capabilities")}
          </summary>
          <div>
            <h3>{t("基础公开源", "Basic public sources")}</h3>
            <p>
              {t(
                "Wikipedia 和 GDELT 无需在此配置密钥，但可用性受网络和提供方限制。百科只帮助确认检索对象，新闻索引只提供线索。此模式不覆盖所有 creator。",
                "Wikipedia and GDELT need no API key here, but access depends on the network and provider. Encyclopedia entries help identify subjects; news indexes provide leads. Many creators will not be covered.",
              )}
            </p>
            <h3>Brave Search</h3>
            <p>
              {t(
                "在项目 .env 文件中设置 BRAVE_SEARCH_API_KEY 并重新启动。密钥仅在服务器读取，不要填写到搜索框或上传 GitHub。线上部署需要单独设置服务器密钥。",
                "Set BRAVE_SEARCH_API_KEY in the project .env file and restart. Keys stay on the server; never enter them in search or commit them to GitHub. Hosted deployments require a separate server secret.",
              )}
            </p>
            <p>
              {t(
                "配置后：候选检索最多调用 1 次，资料检索最多调用 3 次（近三年、回应、历史补查），费用与使用限制以你的服务方案为准。",
                "When configured: candidate search makes up to one request; research makes up to three (recent, responses, historical). Charges and limits depend on your provider plan.",
              )}
            </p>
            <a
              href="https://api-dashboard.search.brave.com/documentation/quickstart"
              target="_blank"
              rel="noopener noreferrer"
            >
              {t("官方配置说明", "Official setup guide")}{" "}
              <ExternalLink size={13} />
            </a>
            <p>
              {t(
                "当前版本不生成 AI 风险判断。搜索摘录只能提供线索；评分、受众与品牌适配需要更完整的原始材料和审核方法。",
                "This version does not generate AI risk judgments. Search snippets are leads; scores, audiences and brand fit need fuller original material and a validated review method.",
              )}
            </p>
          </div>
        </details>
      </main>
      <Sheet
        open={!!drawer}
        onOpenChange={(open) => {
          if (!open) setDrawer(null);
        }}
      >
        <SheetContent className="live-drawer" showCloseButton={false}>
          <SheetClose
            className="live-drawer-close"
            aria-label={t("关闭证据", "Close evidence")}
          >
            <X size={20} />
          </SheetClose>
          <SheetTitle>{t("来源证据详情", "Source details")}</SheetTitle>
          <SheetDescription>
            {t(
              "真实索引记录 · 内容与归属尚待核实",
              "Real index record · content and attribution unverified",
            )}
          </SheetDescription>
          {drawer && (
            <>
              <span className="live-pill">
                {t(
                  "待核查线索 · 非事实认定",
                  "Unreviewed lead · not a finding",
                )}
              </span>
              <h2>{drawer.title}</h2>
              <a
                className="live-origin"
                href={drawer.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                {t("打开原始来源", "Open original source")}{" "}
                <ExternalLink size={15} />
              </a>
              <p className="live-url">{drawer.url}</p>
              <dl>
                <dt>{t("发布者 / 数据提供方", "Publisher / provider")}</dt>
                <dd>
                  {drawer.publisher} / {drawer.provider}
                </dd>
                <dt>{t("原始发布日期", "Original publication date")}</dt>
                <dd>{date(drawer.publishedAt)}</dd>
                <dt>
                  {t(
                    "索引发现或更新日期（非发布日期）",
                    "Index discovery or update date (not publication)",
                  )}
                </dt>
                <dd>{date(drawer.indexedAt)}</dd>
                <dt>{t("本次查询日期", "Retrieved at")}</dt>
                <dd>{date(drawer.retrievedAt)}</dd>
              </dl>
              <h3>{t("索引摘录", "Index excerpt")}</h3>
              <p>
                {drawer.excerpt ||
                  t(
                    "数据源没有返回正文摘录。请打开来源阅读。",
                    "No content excerpt was returned. Open the source to read it.",
                  )}
              </p>
              <h3>{t("支持什么判断", "What this supports")}</h3>
              <p>
                {t(
                  "仅支持该数据源在查询时返回了这条线索。不能单独证明事件属实、账号归属或当前合作风险。",
                  "Only that the provider returned this lead at retrieval time. It does not independently establish an event, account ownership or current partnership risk.",
                )}
              </p>
              <h3>
                {t("局限与不同解释", "Limitations & alternative explanations")}
              </h3>
              <p>
                {t(
                  "摘要可能截断、过时或指向同名人物；转载可能重复同一事件；索引日期可能是更新或发现日期。需检查原文、当事人回应、事件后续及独立来源。没有负面结果不等于低风险。",
                  "Snippets may be truncated, outdated or about a namesake. Reposts may repeat one event. Index dates may reflect discovery or updates. Check originals, responses, follow-ups and independent sources. No negative results does not imply low risk.",
                )}
              </p>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
type Review = {
  checked: boolean[];
  notes: string;
  decision: string;
  reason: string;
  sourceStates: Record<string, string>;
};
const emptyReview = (): Review => ({
  checked: [false, false, false],
  notes: "",
  decision: "pending",
  reason: "",
  sourceStates: {},
});
function ReviewPanel({
  subject,
  result,
}: {
  subject: Candidate;
  result: LiveResult;
}) {
  const { language } = useLanguage();
  const t = (zh: string, en: string) => (language === "en" ? en : zh);
  const [review, setReview] = useState<Review>(emptyReview);
  const [ready, setReady] = useState(false);
  const [saved, setSaved] = useState(true);
  const key = `creator-risk-live-review-v1:${subject.id}`;
  useEffect(() => {
    try {
      const r = JSON.parse(localStorage.getItem(key) || "null");
      if (
        r &&
        Array.isArray(r.checked) &&
        r.checked.length === 3 &&
        r.checked.every((v: unknown) => typeof v === "boolean") &&
        typeof r.notes === "string" &&
        typeof r.reason === "string" &&
        ["pending", "candidate", "hold"].includes(r.decision) &&
        r.sourceStates &&
        typeof r.sourceStates === "object"
      )
        setReview(r);
    } catch {
      setSaved(false);
    }
    setReady(true);
  }, [key]);
  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(key, JSON.stringify(review));
      setSaved(true);
    } catch {
      setSaved(false);
    }
  }, [ready, review, key]);
  const update = (r: Partial<Review>) => setReview((v) => ({ ...v, ...r }));
  const draft = review.decision !== "pending" && !review.reason.trim();
  function download() {
    const payload = {
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      subject,
      retrieval: result,
      humanReview: review,
      reviewStatus: draft ? "draft" : "recorded",
      automatedScore: null,
    };
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "creator-risk-research.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const checks = [
    t(
      "核实主页与本人归属；跨平台合并需要公开互链或本人声明。",
      "Verify account ownership; cross-platform merging needs public links or a creator statement.",
    ),
    t(
      "阅读原始内容、回应及后续；将转载去重，区分事实、指称和评论。",
      "Read originals, responses and follow-ups; deduplicate reposts and separate facts, allegations and opinions.",
    ),
    t(
      "向 creator 索取近期合作披露、授权受众数据与重大旧事的处理说明。",
      "Request recent sponsorship disclosures, authorized audience data and explanations of material past events.",
    ),
  ];
  return (
    <aside className="live-panel live-review">
      <div className="live-section-head">
        <h2>{t("03 / 人工核查", "03 / Human review")}</h2>
        <span>{review.checked.filter(Boolean).length}/3</span>
      </div>
      <p className="live-muted">
        {t(
          "人工记录保存在此浏览器，不会改变自动分数。",
          "Human notes are saved in this browser and do not create an automated score.",
        )}
      </p>
      {checks.map((c, i) => (
        <label className="live-check" key={i}>
          <input
            type="checkbox"
            checked={review.checked[i]}
            disabled={!ready}
            onChange={(e) =>
              update({
                checked: review.checked.map((v, j) =>
                  i === j ? e.target.checked : v,
                ),
              })
            }
          />
          <span>{c}</span>
        </label>
      ))}
      <label>
        {t("人工合作判断", "Human partnership decision")}
        <select
          value={review.decision}
          disabled={!ready}
          onChange={(e) => update({ decision: e.target.value })}
        >
          <option value="pending">
            {t("需人工复核", "Further review required")}
          </option>
          <option value="candidate">
            {t("可进入候选（人工判断）", "Consider for shortlist (human)")}
          </option>
          <option value="hold">
            {t("建议暂缓（人工判断）", "Recommend holding (human)")}
          </option>
        </select>
      </label>
      <label>
        {t("判断依据与待解决问题", "Reasoning & unresolved questions")}
        <textarea
          value={review.reason}
          disabled={!ready}
          maxLength={5000}
          onChange={(e) => update({ reason: e.target.value })}
          placeholder={t(
            "引用具体来源；说明资料缺口对判断的影响。",
            "Cite sources and explain how gaps affect your decision.",
          )}
        />
      </label>
      {draft && (
        <small className="live-error">
          {t(
            "草稿：填写依据后才记为人工判断。",
            "Draft: add reasoning to record a human decision.",
          )}
        </small>
      )}
      <details>
        <summary>{t("逐条标记来源", "Triage each source")}</summary>
        {result.sources.map((s) => (
          <label className="live-triage" key={s.id}>
            <a href={s.url} target="_blank" rel="noopener noreferrer">
              {s.title} <ExternalLink size={11} />
            </a>
            <select
              aria-label={`${t("来源标记", "Source status")}: ${s.title}`}
              value={review.sourceStates[s.id] || "unreviewed"}
              onChange={(e) =>
                update({
                  sourceStates: {
                    ...review.sourceStates,
                    [s.id]: e.target.value,
                  },
                })
              }
            >
              <option value="unreviewed">{t("未核查", "Unreviewed")}</option>
              <option value="relevant">
                {t("已核查：与对象相关", "Reviewed: relevant")}
              </option>
              <option value="claim">
                {t("公开指称：仍待证实", "Public allegation: unverified")}
              </option>
              <option value="opinion">
                {t("评论意见", "Comment or opinion")}
              </option>
              <option value="excluded">
                {t("排除：无关或重复", "Exclude: unrelated or duplicate")}
              </option>
            </select>
          </label>
        ))}
      </details>
      <label>
        {t("审核备注", "Review notes")}
        <textarea
          value={review.notes}
          disabled={!ready}
          maxLength={10000}
          onChange={(e) => update({ notes: e.target.value })}
        />
      </label>
      <small aria-live="polite">
        {saved ? <Check size={13} /> : null}{" "}
        {saved
          ? t("仅保存在此浏览器", "Saved in this browser only")
          : t(
              "浏览器无法保存，请导出记录",
              "Browser storage unavailable; export your notes",
            )}
      </small>
      <button className="live-export" onClick={download}>
        <Download size={15} />{" "}
        {t("导出来源与审核记录", "Export sources & review")}
      </button>
    </aside>
  );
}
