import type { Metadata } from "next";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = {
  title: "Card Vault",
  description: "个人球星卡的本地录入、管理、展示与分享。"
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
