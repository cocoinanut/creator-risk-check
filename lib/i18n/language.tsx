"use client";
import {
  cloneElement,
  createContext,
  isValidElement,
  useContext,
  useEffect,
  useState,
  type ReactNode,
  type ReactElement,
} from "react";
import { Languages } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { translate, type Language } from "./translate";

const LANGUAGE_KEY = "creator-risk-language-v1";
const LanguageContext = createContext<{
  language: Language;
  setLanguage: (language: Language) => void;
}>({ language: "zh", setLanguage: () => {} });
export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, updateLanguage] = useState<Language>("zh");
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("lang");
    try {
      const saved = localStorage.getItem(LANGUAGE_KEY);
      updateLanguage(
        requested === "en" || requested === "zh"
          ? requested
          : saved === "en"
            ? "en"
            : "zh",
      );
    } catch {
      if (requested === "en") updateLanguage("en");
    }
    setReady(true);
    const sync = (event: StorageEvent) => {
      if (event.key === LANGUAGE_KEY)
        updateLanguage(event.newValue === "en" ? "en" : "zh");
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);
  useEffect(() => {
    if (!ready) return;
    document.documentElement.lang = language === "en" ? "en" : "zh-CN";
    document.title =
      language === "en"
        ? "Creator Risk Check | Creator Partnership Review"
        : "Creator Risk Check | Creator 合作风险审核";
    try {
      localStorage.setItem(LANGUAGE_KEY, language);
    } catch {
      /* Language switching still works when storage is unavailable. */
    }
  }, [language, ready]);
  function setLanguage(next: Language) {
    updateLanguage(next);
    const url = new URL(window.location.href);
    if (url.searchParams.has("lang")) {
      url.searchParams.set("lang", next);
      window.history.replaceState(window.history.state, "", url);
    }
  }
  return (
    <LanguageContext.Provider value={{ language, setLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
}
export const useLanguage = () => useContext(LanguageContext);
export function LanguagePicker() {
  const { language, setLanguage } = useLanguage();
  return (
    <div className="language-picker">
      <Languages size={16} aria-hidden="true" />
      <Select
        value={language}
        onValueChange={(value) => {
          if (value === "zh" || value === "en") setLanguage(value);
        }}
      >
        <SelectTrigger
          className="language-select"
          aria-label={language === "en" ? "Page language" : "页面语言"}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="zh">中文</SelectItem>
          <SelectItem value="en">English</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

/** Translate rendered copy without mutating the DOM or modifying form values and callbacks.
 * Leaf components that generate their own copy (e.g. EventCard) use their own boundary.
 * Element types, keys and refs are retained, so changing language preserves open panels and drafts.
 */
export function localizeTree(node: ReactNode, language: Language): ReactNode {
  if (typeof node === "string") return translate(node, language);
  if (Array.isArray(node))
    return node.map((child) => localizeTree(child, language));
  if (!isValidElement(node)) return node;
  const element = node as ReactElement<Record<string, unknown>>;
  if (element.props["data-no-translate"]) return node;
  const next: Record<string, unknown> = {};
  for (const name of ["title", "placeholder", "aria-label", "alt"]) {
    if (typeof element.props[name] === "string")
      next[name] = translate(element.props[name] as string, language);
  }
  if ("children" in element.props)
    next.children = localizeTree(element.props.children as ReactNode, language);
  return cloneElement(element, next);
}
export function Localized({ children }: { children: ReactNode }) {
  const { language } = useLanguage();
  return localizeTree(children, language);
}
