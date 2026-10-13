"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "./language-provider";

export function RefreshPageButton({ reset }: { reset?: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const { locale } = useLanguage();
  const en = locale === "en";
  return <button className="btn btn-primary" type="button" disabled={pending} onClick={() => startTransition(() => {
    router.refresh();
    reset?.();
  })}>{pending ? (en ? "Retrying…" : "正在重试…") : (en ? "Try again" : "重试")}</button>;
}

export function PageRecovery({ reset }: { reset: () => void }) {
  const { locale } = useLanguage();
  const en = locale === "en";
  return <section className="panel page-recovery" role="alert">
    <h1 className="h1">{en ? "This page could not be loaded" : "暂时无法加载此页面"}</h1>
    <p>{en
      ? "Try again to reload the current page with the same filters. If the problem continues, reload the window or open Settings to check data health."
      : "可重试加载当前页面，筛选条件会保留。若仍无法打开，请重新加载窗口，或前往设置检查数据健康。"}</p>
    <div className="page-recovery-actions">
      <RefreshPageButton reset={reset} />
      <button className="btn btn-secondary" type="button" onClick={() => window.location.reload()}>{en ? "Reload page" : "重新加载页面"}</button>
      <a className="btn btn-secondary" href="/settings#data-settings">{en ? "Open Settings" : "前往设置"}</a>
      <a className="btn btn-secondary" href="/">{en ? "Home" : "返回首页"}</a>
    </div>
  </section>;
}
