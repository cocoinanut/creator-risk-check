import type { Metadata } from "next";
import "./globals.css";
import { LanguageProvider } from "@/lib/i18n/language";

export const metadata: Metadata = {
  title: "Creator Risk Check | Creator 合作风险审核",
  description:
    "公开证据驱动的 Creator 合作风险审核工作台。包含公开资料检索与三个完全虚构的交互演示案例。",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">
        <LanguageProvider>{children}</LanguageProvider>
      </body>
    </html>
  );
}
