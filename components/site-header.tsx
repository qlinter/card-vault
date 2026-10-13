"use client";

import { UiText } from "@/components/ui-text";
import Link, { useLinkStatus } from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { LanguageSwitch } from "@/components/language-switch";
import { useLanguage } from "./language-provider";

function DelayedNavigationStatus() {
  const [visible, setVisible] = useState(false);
  const { locale } = useLanguage();
  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(true), 400);
    return () => window.clearTimeout(timer);
  }, []);
  return visible ? <span className="navigation-pending" role="status" aria-label={locale === "en" ? "Opening page" : "正在打开页面"} /> : null;
}

function NavigationStatus() {
  const { pending } = useLinkStatus();
  return pending ? <DelayedNavigationStatus /> : null;
}

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
          <Link href="/portfolio" className={isActive("/portfolio") ? "active" : undefined}><UiText text={"组合"} /><NavigationStatus /></Link>
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
