import type { PortfolioAllocationBreakdown, PortfolioBreakdown, PortfolioTimeSeriesPoint } from "./portfolio-analysis-types.ts";
import { roundPortfolioValue as money } from "./portfolio-number.ts";
export function mergeGroups<T extends PortfolioBreakdown & {
  valuedCount?: number;
}>(left: T[], right: T[]): T[] {
  const groups = new Map(left.map(item => [item.name, item]));
  for (const item of right) {
    const current = groups.get(item.name);
    if (!current) {
      groups.set(item.name, { ...item, values: { ...item.values } });
      continue;
    }
    current.count += item.count;
    for (const [currency, value] of Object.entries(item.values))
      current.values[currency] = money((current.values[currency] ?? 0) + value);
    if (current.valuedCount !== undefined && item.valuedCount !== undefined)
      current.valuedCount += item.valuedCount;
  }
  return [...groups.values()];
}
export function finalizeAllocation(items: PortfolioAllocationBreakdown[], count: number) {
  const totals: Record<string, number> = {};
  for (const item of items)
    for (const [currency, value] of Object.entries(item.values))
      totals[currency] = money((totals[currency] ?? 0) + value);
  for (const item of items) {
    item.countShare = money(item.count / (count || 1) * 100);
    item.valueShare = {};
    item.averageValue = {};
    for (const [currency, value] of Object.entries(item.values)) {
      item.valueShare[currency] = totals[currency] > 0 ? money(value / totals[currency] * 100) : 0;
      item.averageValue[currency] = item.valuedCount > 0 ? money(value / item.valuedCount) : 0;
    }
  }
  return items.sort((a, b) => b.count - a.count || (b.valueShare.CNY ?? 0) - (a.valueShare.CNY ?? 0) || a.name.localeCompare(b.name));
}
export function mergeSeries(left: PortfolioTimeSeriesPoint[], right: PortfolioTimeSeriesPoint[]) {
  const points = new Map(left.map(item => [item.month, item]));
  for (const item of right) {
    const current = points.get(item.month) ?? { month: item.month, count: 0, values: {} };
    current.count += item.count;
    for (const [currency, value] of Object.entries(item.values))
      current.values[currency] = money((current.values[currency] ?? 0) + value);
    const missing = [...new Set([...(current.missingCurrencies ?? []), ...(item.missingCurrencies ?? [])])];
    if (missing.length) {
      current.missingCurrencies = missing;
      for (const currency of missing)
        delete current.values[currency];
    }
    points.set(item.month, current);
  }
  return [...points.values()].sort((a, b) => a.month.localeCompare(b.month));
}
