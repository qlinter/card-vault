"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function SiteHeader() {
  const pathname = usePathname();
  const homeHref = pathname.startsWith("/showcase") ? "/showcase" : "/";

  return (
    <header className="topbar">
      <div className="container topbar-inner">
        <Link href={homeHref} className="brand">
          Card Vault
        </Link>
        <nav className="nav-links">
          <Link href="/">首页</Link>
          <Link href="/showcase">展示页</Link>
        </nav>
      </div>
    </header>
  );
}
