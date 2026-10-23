"use client";
import { useLinkStatus } from "next/link";
import { useEffect, useState } from "react";
import { useLanguage } from "./language-provider";
function DelayedNavigationStatus() {
  const [visible, setVisible] = useState(false);
  const { locale } = useLanguage();
  useEffect(() => { const timer = window.setTimeout(() => setVisible(true), 400); return () => window.clearTimeout(timer); }, []);
  return visible ? <span className="navigation-pending" role="status" aria-label={locale === "en" ? "Opening page" : "正在打开页面"} /> : null;
}
export function NavigationStatus() { const { pending } = useLinkStatus(); return pending ? <DelayedNavigationStatus /> : null; }
