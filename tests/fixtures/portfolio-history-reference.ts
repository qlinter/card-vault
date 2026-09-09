// Frozen pre-optimization reference for financial output equivalence tests.
import { isOwnedCollectionStatus } from "../../lib/card-stats.ts";
import { minorMoneyToNumber, selectLatestValuation } from "../../lib/financial-history.ts";
import { roundPortfolioValue as money } from "../../lib/portfolio-number.ts";
import { calculatePositions } from "./position-accounting-reference.ts";
import type { PortfolioCardRecord } from "../../lib/portfolio-analysis-types.ts";
import type { PortfolioFinancialHistoryCurrency, PortfolioFinancialHistoryPoint } from "../../lib/portfolio-insights.ts";
function recordDate(record: { occurredAt?: Date; createdAt?: Date }): Date {
  if (record.occurredAt instanceof Date && !Number.isNaN(record.occurredAt.getTime())) return record.occurredAt;
  if (record.createdAt instanceof Date && !Number.isNaN(record.createdAt.getTime())) return record.createdAt;
  return new Date(0);
}

function cardExistedAt(card: PortfolioCardRecord, at: Date): boolean {
  const hasBusinessRecord = card.transactions.some((record) => recordDate(record).getTime() <= at.getTime())
    || card.expenses.some((record) => recordDate(record).getTime() <= at.getTime())
    || card.valuations.some((record) => record.valuedAt.getTime() <= at.getTime());
  return hasBusinessRecord || !(card.createdAt instanceof Date) || card.createdAt.getTime() <= at.getTime();
}

function nextMonth(month: string): string {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Date(Date.UTC(year, monthNumber, 1)).toISOString().slice(0, 7);
}

function monthCutoff(month: string, asOf: Date): Date {
  if (month === asOf.toISOString().slice(0, 7)) return asOf;
  const [year, monthNumber] = month.split("-").map(Number);
  return new Date(Date.UTC(year, monthNumber, 1) - 1);
}

export function buildPortfolioFinancialHistory(
  cards: PortfolioCardRecord[],
  asOf = new Date()
): PortfolioFinancialHistoryPoint[] {
  let earliest = Infinity;
  const includeDate = (date: Date) => {
    const time = date.getTime();
    if (time <= asOf.getTime() && time < earliest) earliest = time;
  };
  for (const card of cards) {
    for (const row of card.transactions) includeDate(recordDate(row));
    for (const row of card.expenses) includeDate(recordDate(row));
    for (const row of card.valuations) includeDate(row.valuedAt);
  }
  if (earliest === Infinity) return [];

  const firstMonth = new Date(earliest).toISOString().slice(0, 7);
  const lastMonth = asOf.toISOString().slice(0, 7);
  const months: string[] = [];
  for (let month = firstMonth; month <= lastMonth; month = nextMonth(month)) months.push(month);

  return months.map((month) => {
    const at = monthCutoff(month, asOf);
    const totals = new Map<string, PortfolioFinancialHistoryCurrency>();
    const coverage = new Map<string, { currency: string; active: number; valued: number; costKnown: number }>();
    for (const card of cards) {
      if (!cardExistedAt(card, at)) continue;
      const transactions = card.transactions.filter((record) => recordDate(record).getTime() <= at.getTime());
      const expenses = card.expenses.filter((record) => recordDate(record).getTime() <= at.getTime());
      const valuations = card.valuations.filter((record) => record.valuedAt.getTime() <= at.getTime());
      const positions = calculatePositions({ transactions, expenses, valuations });
      for (const position of positions) {
        const fallbackQuantity = card.transactions.length === 0 && isOwnedCollectionStatus(card.collectionStatus)
          ? Math.max(0, card.holdingQuantity ?? 1)
          : 0;
        const quantity = position.purchasedQuantity > 0 || position.soldQuantity > 0
          ? position.remainingQuantity
          : fallbackQuantity;
        const latestValuation = selectLatestValuation(valuations, position.currency);
        const portfolioValue = latestValuation && quantity > 0
          ? minorMoneyToNumber(latestValuation.amountMinor * BigInt(quantity), position.currency)
          : 0;
        const remainingCost = quantity > 0
          ? minorMoneyToNumber(position.remainingCostMinor, position.currency)
          : 0;
        const realizedProfit = minorMoneyToNumber(position.realizedProfitMinor, position.currency);
        const unrealizedProfit = latestValuation && quantity > 0
          ? money(portfolioValue - remainingCost)
          : 0;
        const current = totals.get(position.currency) ?? {
          currency: position.currency,
          portfolioValue: 0,
          remainingCost: 0,
          realizedProfit: 0,
          unrealizedProfit: 0
        };
        current.portfolioValue = money((current.portfolioValue ?? 0) + portfolioValue);
        current.remainingCost = current.remainingCost === null || !position.costComplete ? null : money(current.remainingCost + remainingCost);
        current.realizedProfit = current.realizedProfit === null || !position.profitComplete ? null : money(current.realizedProfit + realizedProfit);
        // Only quoted holdings contribute to this historical, potentially partial return.
        if (quantity > 0 && latestValuation) current.unrealizedProfit = current.unrealizedProfit === null || !position.profitComplete ? null : money(current.unrealizedProfit + unrealizedProfit);
        totals.set(position.currency, current);
        const counts = coverage.get(position.currency) ?? { currency: position.currency, active: 0, valued: 0, costKnown: 0 };
        if (quantity > 0) { counts.active++; if (latestValuation) counts.valued++; if (position.costComplete) counts.costKnown++; }
        coverage.set(position.currency, counts);
      }
    }
    for (const [currency, counts] of coverage) {
      if (counts.active > 0 && counts.valued === 0) {
        const total = totals.get(currency)!;
        total.portfolioValue = total.unrealizedProfit = null;
      }
    }
    return {
      month,
      capturedAt: at.toISOString(),
      coverage: [...coverage.values()],
      currencies: [...totals.values()].sort((left, right) => left.currency.localeCompare(right.currency))
    };
  });
}

