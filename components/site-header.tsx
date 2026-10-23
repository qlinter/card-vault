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
  const homeHref = pathname.startsWith("/showcase") ? "/showcase" : "/";
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`));

  return (
    <header className="topbar">
      <div className="container topbar-inner">
        <Link href={homeHref} className="brand">
          Card Vault
          <NavigationStatus />
        </Link>
        <nav className="nav-links">
          <Link href="/" className={isActive("/") ? "active" : undefined}><UiText text={"首页"} /><NavigationStatus /></Link>
          <Link href="/portfolio" className={isActive("/portfolio") ? "active" : undefined}><UiText text={"数据"} /><NavigationStatus /></Link>
          <Link href="/showcase" className={isActive("/showcase") ? "active" : undefined}><UiText text={"展示"} /><NavigationStatus /></Link>
          <Link href="/shares" className={isActive("/shares") ? "active" : undefined}><UiText text={"分享"} /><NavigationStatus /></Link>
          <Link href="/collection" className={isActive("/collection") ? "active" : undefined}>{locale === "en" ? "Scout" : "寻卡"}<NavigationStatus /></Link>
          <Link href="/settings" className={isActive("/settings") ? "active" : undefined}><UiText text={"设置"} /><NavigationStatus /></Link>
        </nav>
        <LanguageSwitch />

      </div>
    </header>
  );
}
