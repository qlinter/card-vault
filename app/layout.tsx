import type { Metadata } from "next";
import { cookies } from "next/headers";
import "./globals.css";
import { LanguageProvider } from "@/components/language-provider";
import { SiteHeader } from "@/components/site-header";
import { normalizeUiLocale, UI_LOCALE_COOKIE } from "@/lib/ui-locale";

export async function generateMetadata(): Promise<Metadata> {
  const cookieStore = await cookies();
  const locale = normalizeUiLocale(cookieStore.get(UI_LOCALE_COOKIE)?.value);
  return {
    title: "Card Vault",
    description: locale === "en"
      ? "A local desktop app for cataloging, managing, showcasing, and sharing sports cards."
      : "个人球星卡的本地录入、管理、展示与分享。"
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const locale = normalizeUiLocale(cookieStore.get(UI_LOCALE_COOKIE)?.value);
  return (
    <html lang={locale} data-ui-locale={locale} data-ui-ready={locale === "en" ? "false" : "true"}>
      <body>
        <LanguageProvider initialLocale={locale}>
          <div className="site-bg" />
          <SiteHeader />
          <main className="container">{children}</main>
        </LanguageProvider>
      </body>
    </html>
  );
}
