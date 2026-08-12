import type { CardExpense, CardTransaction, CardValuation, Prisma } from "@prisma/client";
import { minorMoneyToNumber, selectLatestValuation } from "./financial-history.ts";

type FinancialRows = {
  transactions: CardTransaction[];
  expenses: CardExpense[];
  valuations: CardValuation[];
};

export function deriveLegacyFinancialSnapshot(history: FinancialRows): Prisma.CardUpdateInput {
  const cnyTransactions = history.transactions.filter((row) => row.currency === "CNY");
  const purchases = cnyTransactions.filter((row) => row.kind === "purchase");
  const refunds = cnyTransactions.filter((row) => row.kind === "refund");
  const cnyExpenses = history.expenses.filter((row) => row.currency === "CNY");
  const gradingExpenses = cnyExpenses.filter((row) => row.kind === "grading");
  const latestValuation = selectLatestValuation(history.valuations, "CNY");
  const earliestPurchase = purchases
    .slice()
    .sort((left, right) => left.occurredAt.getTime() - right.occurredAt.getTime())[0];

  const purchaseMinor = purchases.reduce((sum, row) => sum + row.amountMinor, BigInt(0))
    - refunds.reduce((sum, row) => sum + row.amountMinor, BigInt(0));
  const expenseMinor = cnyExpenses.reduce((sum, row) => sum + row.amountMinor, BigInt(0));
  const gradingMinor = gradingExpenses.reduce((sum, row) => sum + row.amountMinor, BigInt(0));
  const normalizedPurchaseMinor = purchaseMinor > BigInt(0) ? purchaseMinor : BigInt(0);

  return {
    purchaseDate: earliestPurchase?.occurredAt ?? null,
    purchasePrice: purchases.length || refunds.length ? minorMoneyToNumber(normalizedPurchaseMinor, "CNY") : null,
    gradingFee: gradingExpenses.length ? minorMoneyToNumber(gradingMinor, "CNY") : null,
    totalCost: purchases.length || refunds.length || cnyExpenses.length
      ? minorMoneyToNumber(normalizedPurchaseMinor + expenseMinor, "CNY")
      : null,
    currentValue: latestValuation ? minorMoneyToNumber(latestValuation.amountMinor, "CNY") : null,
    purchaseSource: earliestPurchase?.source ?? null
  };
}
