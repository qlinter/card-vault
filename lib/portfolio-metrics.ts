import type { PortfolioSnapshot } from "./portfolio-analysis-types.ts";

export function valuationCoverage(valuedCount: number, eligibleCount: number) {
  return { valuedCount, eligibleCount, percent: eligibleCount > 0 ? valuedCount / eligibleCount * 100 : null, complete: eligibleCount > 0 && valuedCount >= eligibleCount };
}
export function portfolioSummaryMetrics(snapshot: PortfolioSnapshot, currency: string) {
  const summary = snapshot.financials.currencies.find(row => row.currency === currency);
  return [
    { key: "value", label: "持仓估值", value: summary && snapshot.financials.valuationCoverageCount ? summary.activeLatestValue : null, signed: false },
    { key: "cost", label: "剩余成本", value: summary?.activeCostBasis ?? null, signed: false },
    { key: "unrealized", label: "未实现盈亏", value: summary?.unrealizedDifference ?? null, signed: true },
    { key: "realized", label: "已实现盈亏", value: summary?.realizedProfit ?? null, signed: true }
  ] as const;
}
