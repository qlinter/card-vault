import { calculatePositions, type CurrencyPosition } from "./position-accounting.ts";
import { normalizeCurrency } from "./financial-history.ts";
import type { PortfolioCardRecord } from "./portfolio-analysis-types.ts";

function time(row: { occurredAt?: Date; createdAt?: Date }) {
  if (row.occurredAt instanceof Date && Number.isFinite(row.occurredAt.getTime())) return row.occurredAt.getTime();
  return row.createdAt instanceof Date && Number.isFinite(row.createdAt.getTime()) ? row.createdAt.getTime() : 0;
}

// Request-local chronological cursor. Reuse balances only while inventory facts
// are unchanged; every recalculation still uses the shared accounting engine.
export function createPortfolioHistoryCursor(card: PortfolioCardRecord) {
  const transactions = [...card.transactions].sort((a, b) => time(a) - time(b));
  const expenses = [...card.expenses].sort((a, b) => time(a) - time(b));
  const valuations = card.valuations.filter(row => Number.isFinite(row.valuedAt.getTime())).sort((a, b) => a.valuedAt.getTime() - b.valuedAt.getTime());
  const activeTransactions: typeof transactions = [], activeExpenses: typeof expenses = [];
  const latest = new Map<string, typeof valuations[number]>();
  let ti = 0, ei = 0, vi = 0, cutoff = -Infinity;
  let positions: Pick<CurrencyPosition, "currency" | "purchasedQuantity" | "soldQuantity" | "remainingQuantity" | "remainingCostMinor" | "realizedProfitMinor" | "costComplete" | "profitComplete">[] = [];
  return (at: Date) => {
    const next = at.getTime();
    if (next < cutoff) throw new Error("Historical cutoffs must be chronological.");
    cutoff = next;
    let changed = false;
    while (ti < transactions.length && time(transactions[ti]) <= next) { activeTransactions.push(transactions[ti++]); changed = true; }
    while (ei < expenses.length && time(expenses[ei]) <= next) { activeExpenses.push(expenses[ei++]); changed = true; }
    while (vi < valuations.length && valuations[vi].valuedAt.getTime() <= next) {
      const row = valuations[vi++], currency = normalizeCurrency(row.currency), previous = latest.get(currency);
      if (!previous) changed = true;
      if (!previous || row.valuedAt > previous.valuedAt || (row.valuedAt.getTime() === previous.valuedAt.getTime() && row.createdAt > previous.createdAt)) latest.set(currency, row);
    }
    const quotes = [...latest.values()];
    if (changed) positions = calculatePositions({ transactions: activeTransactions, expenses: activeExpenses, valuations: quotes });
    return { positions, valuations: quotes };
  };
}
