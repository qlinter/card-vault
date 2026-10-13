"use client";

import { useLanguage } from "./language-provider";

export function ComparisonLoading() {
  const { locale } = useLanguage();
  const en = locale === "en";
  const title = en ? "Loading comparison…" : "正在加载比较…";
  return (
    <section className="page-loading is-compact" aria-busy="true" data-testid="comparison-loading">
      <p role="status" aria-live="polite">{title}</p>
    </section>
  );
}
