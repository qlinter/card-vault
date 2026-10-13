import type { PortfolioSnapshot } from "./portfolio-analysis-types.ts";
import { roundPortfolioValue as money } from "./portfolio-number.ts";
type Financials = PortfolioSnapshot["financials"];
const sumOrMissing = (left: number | null, right: number | null) => left === null || right === null ? null : money(left + right);
export function mergePortfolioFinancials(target: Financials, incoming: Financials) {
  const countFields = ["transactionCoverageCount", "expenseCoverageCount", "valuationCoverageCount", "valuationEligibleCount", "freshValuationCount", "staleValuationCount"] as const;
  for (const key of countFields)
    target[key] += incoming[key];
  for (const row of incoming.currencies) {
    const current = target.currencies.find(item => item.currency === row.currency);
    if (!current) {
      target.currencies.push({ ...row });
      continue;
    }
    for (const key of Object.keys(row) as Array<keyof typeof row>) {
      if (key === "currency" || key === "unrealizedReturnRate")
        continue;
      current[key] = sumOrMissing(current[key], row[key]) as number;
    }
  }
  for (const key of ["latestValuationAt", "oldestLatestValuationAt"] as const) {
    const value = incoming[key], previous = target[key];
    if (value && (!previous || (key === "latestValuationAt" ? value > previous : value < previous)))
      target[key] = value;
  }
  for (const source of incoming.valuationSources) {
    const current = target.valuationSources.find(item => item.name === source.name);
    if (current)
      current.count += source.count;
    else
      target.valuationSources.push({ ...source });
  }
}
export function finishPortfolioFinancials(financials: Financials, incompleteCosts: boolean, incompleteValue: boolean) {
  financials.currencies.sort((a, b) => ["CNY", "USD"].indexOf(a.currency) - ["CNY", "USD"].indexOf(b.currency));
  for (const row of financials.currencies) {
    if (incompleteCosts) {
      row.purchaseAmount = row.salesAmount = row.expenseAmount = row.inventoryExpenseAmount = row.saleExpenseAmount = row.netCashInvested = null;
      row.activeCostBasis = row.realizedCost = row.realizedProfit = row.comparableCostBasis = null;
    }
    if (incompleteValue)
      row.unrealizedDifference = row.unrealizedReturnRate = row.totalProfit = null;
    row.unrealizedReturnRate = row.comparableCostBasis !== null && row.comparableCostBasis > 0 && row.unrealizedDifference !== null ? money(row.unrealizedDifference / row.comparableCostBasis * 100) : null;
  }
  financials.valuationSources.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}
