"use client";

import { UiText } from "@/components/ui-text";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LanguageSwitch } from "@/components/language-switch";
import { useLanguage } from "./language-provider";
import { NavigationStatus } from "./navigation-status";

export function SiteHeader() {
  const pathname = usePathname();
  const { locale } = useLanguage();
  const showcaseActive = pathname.startsWith("/showcase") || pathname.startsWith("/shares");
  const collectionActive = pathname === "/" || pathname.startsWith("/cards") || pathname.startsWith("/collection");
  const homeHref = showcaseActive ? "/showcase" : "/";
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`));

  return (
    <header className="topbar">
      <div className="container topbar-inner">
        <Link href={homeHref} className="brand">
          Card Vault
          <NavigationStatus />
        </Link>
        <nav className="nav-links" aria-label={locale === "en" ? "Main navigation" : "主导航"}>
          <Link href="/" className={collectionActive ? "active" : undefined} aria-current={collectionActive ? "page" : undefined}><UiText text="收藏" /><NavigationStatus /></Link>
          <Link href="/showcase" className={showcaseActive ? "active" : undefined} aria-current={showcaseActive ? "page" : undefined}><UiText text="展示" /><NavigationStatus /></Link>
          <Link href="/portfolio" className={isActive("/portfolio") ? "active" : undefined} aria-current={isActive("/portfolio") ? "page" : undefined}><UiText text="数据" /><NavigationStatus /></Link>
        </nav>
        <div className="header-utilities">
          <Link href="/settings" className="header-settings header-tool" aria-current={isActive("/settings") ? "page" : undefined} title={locale === "en" ? "Settings" : "设置"}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 3-1 3-3 1-2 3 2 2-1 3 2 3 3-1 2 3h3l1-3 3-1 2-3-2-2 1-3-2-3-3 1-2-3Z" /><circle cx="11.5" cy="11.5" r="3.5" /></svg>
            <span className="sr-only"><UiText text="设置" /></span><NavigationStatus />
          </Link>
          <LanguageSwitch />
        </div>

      </div>
    </header>
  );
}
