import type { PortfolioCardRecord } from "./portfolio-analysis-types.ts";
import { buildPortfolioFinancialHistory, type PortfolioFinancialHistoryPoint } from "./portfolio-insights.ts";
import { roundPortfolioValue as money } from "./portfolio-number.ts";
const sumOrMissing = (left: number | null, right: number | null) => left === null || right === null ? null : money(left + right);
type HistoryTotal = PortfolioFinancialHistoryPoint["currencies"][number] & {
  quotedProfitMissing: boolean;
};
type HistoryPoint = Omit<PortfolioFinancialHistoryPoint, "currencies"> & {
  currencies: HistoryTotal[];
};
export function createPortfolioHistoryAccumulator(asOf: Date, startMonth?: string) {
  const history = new Map<string, HistoryPoint>();
  let earliest = Infinity;
  function add(cards: PortfolioCardRecord[]) {
    for (const card of cards) {
      for (const row of [...card.transactions, ...card.expenses])
        earliest = Math.min(earliest, (row.occurredAt ?? row.createdAt ?? new Date(0)).getTime());
      for (const row of card.valuations)
        earliest = Math.min(earliest, row.valuedAt.getTime());
    }
    for (const point of buildPortfolioFinancialHistory(cards, asOf, startMonth)) {
      const current = history.get(point.month) ?? { month: point.month, capturedAt: point.capturedAt, currencies: [], coverage: [] };
      for (const total of point.currencies) {
        const counts = point.coverage.find(item => item.currency === total.currency)!;
        const previous = current.currencies.find(item => item.currency === total.currency);
        const quotedProfitMissing = counts.valued > 0 && total.unrealizedProfit === null;
        if (previous) {
          previous.portfolioValue = money((previous.portfolioValue ?? 0) + (total.portfolioValue ?? 0));
          previous.remainingCost = sumOrMissing(previous.remainingCost, total.remainingCost);
          previous.realizedProfit = sumOrMissing(previous.realizedProfit, total.realizedProfit);
          previous.unrealizedProfit = money((previous.unrealizedProfit ?? 0) + (total.unrealizedProfit ?? 0));
          previous.quotedProfitMissing ||= quotedProfitMissing;
        }
        else
          current.currencies.push({ ...total, portfolioValue: total.portfolioValue ?? 0, unrealizedProfit: total.unrealizedProfit ?? 0, quotedProfitMissing });
        const coverage = current.coverage.find(item => item.currency === total.currency);
        if (coverage) {
          coverage.active += counts.active;
          coverage.valued += counts.valued;
          coverage.costKnown += counts.costKnown;
        }
        else
          current.coverage.push({ ...counts });
      }
      history.set(point.month, current);
    }
  }
  function finish(): PortfolioFinancialHistoryPoint[] {
    const firstMonth = earliest === Infinity ? null : new Date(earliest).toISOString().slice(0, 7);
    const financialHistory: PortfolioFinancialHistoryPoint[] = [...history.values()].filter(point => firstMonth !== null && point.month >= firstMonth).sort((a, b) => a.month.localeCompare(b.month)).map(point => ({ ...point, currencies: point.currencies.map(({ quotedProfitMissing, ...row }) => {
        const counts = point.coverage.find(item => item.currency === row.currency)!;
        if (counts.active > 0 && counts.valued === 0)
          row.portfolioValue = row.unrealizedProfit = null;
        else if (quotedProfitMissing)
          row.unrealizedProfit = null;
        return row;
      }).sort((a, b) => a.currency.localeCompare(b.currency)) }));
    return financialHistory;
  }
  return { add, finish };
}
