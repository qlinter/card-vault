"use client";

import { useLanguage } from "./language-provider";
import type { PortfolioSnapshot } from "@/lib/portfolio-analysis-types";

export function FinancialReportNote({ accounting, showBasis = true, showRates = true }: { accounting?: PortfolioSnapshot["accounting"]; showBasis?: boolean; showRates?: boolean }) {
  const { locale } = useLanguage();
  const text = (zh: string, en: string) => locale === "en" ? en : zh;
  if (!accounting) return null;
  return <div className="financial-report-note" data-i18n-skip>
    {showBasis ? <p className="muted">{text("报表币种", "Reporting currency")} {accounting.currency} · {text("原币保留，直接估值优先；折算采用业务日期生效的人工汇率。", "Original amounts retained; direct quotes take precedence. Conversions use the manual rate effective on the business date.")} <a href="/settings#financial-settings">{text("财务设置", "Financial settings")}</a></p> : null}
    {accounting.incompleteCardCount > 0 ? <details className="note-error"><summary>{text(`${accounting.incompleteCardCount} 张卡片财务资料不完整；“—”表示无法完整计算。估值仅覆盖已有报价。`, `${accounting.incompleteCardCount} cards have incomplete financial data. “—” means unavailable; value covers quoted holdings only.`)}</summary><ul>{accounting.missing.map((reason) => <li key={reason}>{reason}</li>)}</ul></details> : null}
    {showRates && accounting.rates.length > 0 ? <details><summary>{text("本次使用的汇率", "Exchange rates used")}</summary><ul>{accounting.rates.map((rate) => <li key={rate.id}>{rate.effectiveDate} · 1 USD = {Number(rate.rateMicros) / 1e6} CNY · {rate.source} · v{rate.revision}</li>)}</ul></details> : null}
  </div>;
}
