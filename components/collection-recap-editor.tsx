"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "./language-provider";
import { CollectionRecapSummary } from "./collection-recap-summary";
import { CollectionRecapCards } from "./collection-recap-cards";
import { normalizeRecapSpec, recapDefaultTitle, recapQuery, type RecapCard, type RecapSpec, type RecapSummary } from "@/lib/collection-recap";
import { buildPortfolioScope } from "@/lib/portfolio-analysis-scope";

type Initial = { spec: RecapSpec; summary: RecapSummary; cards: RecapCard[]; representatives: RecapCard[] };
export function CollectionRecapEditor({ initial }: { initial: Initial }) {
  const { t, locale } = useLanguage(), router = useRouter();
  const { spec, summary } = initial, scope = buildPortfolioScope(spec.scope);
  const [title, setTitle] = useState(recapDefaultTitle(spec, locale));
  const [representatives, setRepresentatives] = useState(initial.representatives);
  const [message, setMessage] = useState("");
  const [switching, startSwitch] = useTransition();
  const filterTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [includePrivate, setIncludePrivate] = useState(false), [exporting, setExporting] = useState(false);
  const exportAbort = useRef<AbortController | undefined>(undefined), downloadUrl = useRef<string | undefined>(undefined);
  useEffect(() => {
    return () => { clearTimeout(filterTimer.current); exportAbort.current?.abort(); if (downloadUrl.current) URL.revokeObjectURL(downloadUrl.current); };
  }, []);
  const resetExport = () => { exportAbort.current?.abort(); setExporting(false); if (downloadUrl.current) URL.revokeObjectURL(downloadUrl.current); downloadUrl.current = undefined;  };
  const edit = () => { setMessage(""); resetExport(); };
  const draft = () => ({ spec, title, representativeIds: representatives.map(card => card.id) });
  function switchPeriod(form: HTMLFormElement, delay = 0) {
    clearTimeout(filterTimer.current);
    if (!form.checkValidity()) return;
    const values = new FormData(form);
    filterTimer.current = setTimeout(() => {
      const next = normalizeRecapSpec({ year: values.get("recapYear"), month: values.get("recapMonth"), basis: values.get("recapBasis"), scope: spec.scope });
      if (recapQuery(next) !== recapQuery(spec)) { resetExport(); startSwitch(() => router.replace(`/portfolio/recap?${recapQuery(next)}`, { scroll: false })); }
    }, delay);
  }
  async function generateImage() {
    resetExport(); const controller = new AbortController(); exportAbort.current = controller; setExporting(true); setMessage("");
    try {
      const response = await fetch("/api/collection-recaps/export", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...draft(), includePrivate, locale }), signal: controller.signal });
      if (!response.ok) { const result = await response.json(); throw new Error(result.error); }
      const blob = await response.blob(); if (controller.signal.aborted) return;
      const url = URL.createObjectURL(blob); downloadUrl.current = url;
      const link = document.createElement("a"); link.href = url; link.download = `Card-Vault-${spec.year}${spec.month ? `-${spec.month}` : ""}-recap.png`; document.body.appendChild(link); link.click(); link.remove();
    } catch (error) { if (!controller.signal.aborted) setMessage(error instanceof Error ? error.message : "回顾图片生成失败，请重试。"); } finally { if (!controller.signal.aborted) setExporting(false); }
  }
  return <div className="page recap-page">
    <h1 className="sr-only">{t("收藏回顾")}</h1>
    <section className="recap-panel">
      <form className="recap-filters" onSubmit={event => { event.preventDefault(); switchPeriod(event.currentTarget); }} onChange={event => switchPeriod(event.currentTarget, event.target instanceof HTMLInputElement && event.target.name === "recapYear" ? 350 : 0)} aria-busy={switching}>
        {Object.entries(spec.scope).map(([key, value]) => value ? <input key={key} type="hidden" name={key} value={value} /> : null)}
        <label>{t("年份")}<input aria-label={t("年份")} type="number" name="recapYear" min="1900" max="2200" defaultValue={spec.year} required /></label>
        <label>{t("月份")}<select aria-label={t("月份")} name="recapMonth" defaultValue={spec.month ?? ""}><option value="">{t("全年")}</option>{Array.from({ length: 12 }, (_, index) => <option key={index} value={index + 1}>{index + 1}</option>)}</select></label>
        <label>{t("回顾口径")}<select aria-label={t("回顾口径")} name="recapBasis" defaultValue={spec.basis}><option value="purchase">{t("购入回顾")}</option><option value="entry">{t("录入回顾")}</option></select></label>
        {scope.isFiltered ? <Link href={`/portfolio/recap?${recapQuery({ ...spec, scope: {} })}`}>{t("切换全部收藏")}</Link> : null}
        <Link href={`/portfolio?${new URLSearchParams(Object.entries(spec.scope).filter((entry): entry is [string, string] => Boolean(entry[1])))}`} className="scope-navigation-link recap-return">{t("返回统计")}</Link>
      </form>
      <p className="recap-muted">{t(scope.isFiltered ? "当前范围：已筛选" : "当前范围：全部收藏")}{scope.criteria.map(item => ` · ${t(item.label)}: ${t(item.value)}`).join("")}</p>
      {summary.missingPurchases ? <p className="recap-muted">{t("范围内 {0} 个档案没有购入记录，未纳入购入回顾。").replace("{0}", String(summary.missingPurchases))}</p> : null}
    </section>
    <div className="recap-content" inert={switching}>
    <section className="recap-panel recap-story">
      <div className="recap-story-header"><label className="recap-title-label"><input aria-label={t("回顾标题")} value={title} maxLength={100} onChange={event => { edit(); setTitle(event.target.value); }} /></label><div className="recap-image-actions"><button type="button" className="recap-privacy" role="switch" aria-checked={includePrivate} onClick={() => { resetExport(); setIncludePrivate(!includePrivate); }}><span className="recap-privacy-track" aria-hidden="true" />{t("包含私密卡片")}</button><button type="button" className="btn" disabled={exporting || !title.trim()} onClick={generateImage}>{t(exporting ? "正在生成…" : "生成长图")}</button></div></div>
      <CollectionRecapSummary spec={spec} summary={summary} />
      <CollectionRecapCards spec={spec} cardCount={summary.cardCount} initialCards={initial.cards} representatives={representatives} onChange={cards => { edit(); setRepresentatives(cards); }} onError={setMessage} />
    </section>

    </div>
    {message ? <p role="status">{t(message)}</p> : null}
  </div>;
}
