"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function SiteHeader() {
  const pathname = usePathname();
  const homeHref = pathname.startsWith("/showcase") ? "/showcase" : "/";
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`));

  return (
    <header className="topbar">
      <div className="container topbar-inner">
        <Link href={homeHref} className="brand">
          Card Vault
        </Link>
        <nav className="nav-links">
          <Link href="/" className={isActive("/") ? "active" : undefined}>首页</Link>
          <Link href="/showcase" className={isActive("/showcase") ? "active" : undefined}>展示</Link>
          <Link href="/shares" className={isActive("/shares") ? "active" : undefined}>分享</Link>
          <Link href="/settings" className={isActive("/settings") ? "active" : undefined}>设置</Link>
        </nav>
      </div>
    </header>
  );
}
