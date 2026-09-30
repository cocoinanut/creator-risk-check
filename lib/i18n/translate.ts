import english from "./en.json";
export type Language = "zh" | "en";
const dictionary: Readonly<Record<string, string>> = english;

/** Only presentation strings are translated; IDs, scores and stored review values stay canonical. */
export function translate(text: string, language: Language): string {
  if (language === "zh" || !/[\u4e00-\u9fff]/.test(text)) return text;
  const normalized = text.replace(/\s+/g, " ").trim();
  const direct = dictionary[normalized];
  if (direct !== undefined) {
    return (
      (text.match(/^\s*/)?.[0] || "") + direct + (text.match(/\s*$/)?.[0] || "")
    );
  }
  let match = normalized.match(/^第(\d+)项审核备注$/);
  if (match) return `Review notes for item ${match[1]}`;
  match = normalized.match(/^(\d+) 条证据$/);
  if (match) return `${match[1]} evidence record${match[1] === "1" ? "" : "s"}`;
  match = normalized.match(/^人工核查 (\d+)$/);
  if (match) return `Human review ${match[1]}`;
  match = normalized.match(/^(.+)：评分证据$/);
  if (match) return `${translate(match[1], language)}: scoring evidence`;
  match = normalized.match(
    /^本案例触发：基础 ([\d.]+) → 85，调整 \+([\d.]+) 分。$/,
  );
  if (match)
    return `Rule triggered: base ${match[1]} → 85, adjustment +${match[2]} points.`;
  // Composed topic lists use the same curated translations as individual labels.
  if (normalized.includes(" · "))
    return normalized
      .split(" · ")
      .map((part) => translate(part, language))
      .join(" · ");
  return text;
}
