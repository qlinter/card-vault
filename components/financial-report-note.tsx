"use client";

import { useLanguage } from "./language-provider";
import type { PortfolioSnapshot } from "@/lib/portfolio-analysis-types";

export type IncompleteFinancialCard = { id: string; playerName: string; cardTitle: string; reasons: string[] };
export function FinancialReportNote({ accounting, incompleteCards = [], returnTo = "/portfolio", showBasis = true }: { accounting?: PortfolioSnapshot["accounting"]; incompleteCards?: IncompleteFinancialCard[]; returnTo?: string; showBasis?: boolean }) {
  const { locale } = useLanguage();
  const text = (zh: string, en: string) => locale === "en" ? en : zh;
  const reasonLabel = (reason: string) => reason.startsWith("FX ") ? text("缺汇率", "Missing exchange rate") : reason.startsWith("COST") ? text("缺成本记录", "Missing cost history") : reason === "VALUATION" ? text("缺估值", "Missing valuation") : reason;
  if (!accounting) return null;
  return <div className="financial-report-note" data-i18n-skip>
    {showBasis ? <p className="financial-report-basis"><span className="financial-report-currency">{text("报表币种", "Reporting currency")} {accounting.currency}</span><span className="financial-report-description">{text("原币保留，直接估值优先；折算采用业务日期生效的人工汇率。", "Original amounts retained; direct quotes take precedence. Conversions use the manual rate effective on the business date.")}</span><a href="/settings#financial-settings">{text("财务设置", "Financial settings")}</a></p> : null}
    {accounting.incompleteCardCount > 0 ? <details className="note-error financial-incomplete"><summary>{text(`财务待完善 · ${accounting.incompleteCardCount} 张`, `Financial data incomplete · ${accounting.incompleteCardCount} card${accounting.incompleteCardCount === 1 ? "" : "s"}`)}</summary><ul>{incompleteCards.length ? incompleteCards.map(card => <li key={card.id}><a href={`/cards/${encodeURIComponent(card.id)}?returnTo=${encodeURIComponent(returnTo)}`}>{card.playerName} · {card.cardTitle}</a><span> · {[...new Set(card.reasons.map(reasonLabel))].join(" · ")}</span></li>) : accounting.missing.map((reason) => <li key={reason}>{reason}</li>)}</ul></details> : null}
  </div>;
}
