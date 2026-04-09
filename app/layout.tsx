import type { Metadata } from "next";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = {
  title: "球星卡收藏库",
  description: "个人球星卡的本地录入、管理、展示与搜索。"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <div className="site-bg" />
        <SiteHeader />
        <main className="container">{children}</main>
      </body>
    </html>
  );
}
