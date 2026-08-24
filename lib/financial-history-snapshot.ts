import type { CardExpense, CardTransaction, CardValuation, Prisma } from "@prisma/client";
import { minorMoneyToNumber, selectLatestValuation } from "./financial-history.ts";
import { calculatePositions } from "./position-accounting.ts";

type FinancialRows = {
  transactions: CardTransaction[];
  expenses: CardExpense[];
  valuations: CardValuation[];
};

export function deriveCardFinancialSummary(history: FinancialRows): Prisma.CardUpdateInput {
  const positions = calculatePositions(history);
  const cnyPosition = positions.find((position) => position.currency === "CNY");
  const cnyTransactions = history.transactions.filter((row) => row.currency === "CNY");
  const purchases = cnyTransactions.filter((row) => row.kind === "purchase");
  const cnyExpenses = history.expenses.filter((row) => row.currency === "CNY");
  const gradingExpenses = cnyExpenses.filter((row) => row.kind === "grading");
  const latestValuation = selectLatestValuation(history.valuations, "CNY");
  const earliestPurchase = purchases
    .slice()
    .sort((left, right) => left.occurredAt.getTime() - right.occurredAt.getTime())[0];

  const purchaseMinor = purchases.reduce((sum, row) => sum + row.amountMinor, BigInt(0));
  const gradingMinor = gradingExpenses.reduce((sum, row) => sum + row.amountMinor, BigInt(0));
  const hasTransactions = history.transactions.length > 0;

  return {
    purchaseDate: earliestPurchase?.occurredAt ?? null,
    purchasePrice: purchases.length ? minorMoneyToNumber(purchaseMinor, "CNY") : null,
    gradingFee: gradingExpenses.length ? minorMoneyToNumber(gradingMinor, "CNY") : null,
    totalCost: cnyPosition && (purchases.length || cnyExpenses.length)
      ? minorMoneyToNumber(cnyPosition.remainingCostMinor, "CNY")
      : null,
    currentValue: latestValuation ? minorMoneyToNumber(latestValuation.amountMinor, "CNY") : null,
    purchaseSource: earliestPurchase?.source ?? null,
    ...(hasTransactions
      ? { holdingQuantity: positions.reduce((sum, position) => sum + position.remainingQuantity, 0) }
      : {})
  };
}
