// Frozen accounting baseline for optimization equivalence checks.
import { normalizeCurrency, selectLatestValuation } from "../../lib/financial-history.ts";
import { paymentComponents } from "../../lib/financial-reporting.ts";

export type PositionTransaction = {
  paymentsJson?: string | null;
  amountKnown?: boolean;
  kind: string;
  amountMinor: bigint;
  currency: string;
  quantity?: number;
  occurredAt?: Date;
  createdAt?: Date;
};

export type PositionExpense = {
  amountKnown?: boolean;
  context?: string;
  amountMinor: bigint;
  currency: string;
  occurredAt?: Date;
  createdAt?: Date;
};

export type PositionValuation = {
  available?: boolean;
  amountMinor: bigint;
  currency: string;
  valuedAt: Date;
  createdAt: Date;
};

export type CurrencyPosition = {
  costComplete: boolean;
  profitComplete: boolean;
  currency: string;
  purchasedQuantity: number;
  soldQuantity: number;
  remainingQuantity: number;
  purchaseAmountMinor: bigint;
  purchaseExpenseMinor: bigint;
  gradingExpenseMinor: bigint;
  inventoryExpenseMinor: bigint;
  saleExpenseMinor: bigint;
  grossSaleAmountMinor: bigint;
  netSaleAmountMinor: bigint;
  realizedCostMinor: bigint;
  remainingCostMinor: bigint;
  averageCostMinor: bigint | null;
  realizedProfitMinor: bigint;
  latestUnitValueMinor: bigint | null;
  currentValueMinor: bigint | null;
  unrealizedProfitMinor: bigint | null;
  totalProfitMinor: bigint | null;
};

type PositionHistory = {
  holdingQuantity?: number;
  transactions: readonly PositionTransaction[];
  expenses: readonly PositionExpense[];
  valuations?: readonly PositionValuation[];
};

type InventoryEvent =
  | { type: "purchase" | "sale"; amountMinor: bigint; quantity: number; occurredAt: Date; createdAt?: Date }
  | { type: "inventory_expense"; amountMinor: bigint; occurredAt: Date; createdAt?: Date }
  | { type: "sale_expense"; amountMinor: bigint; occurredAt: Date; createdAt?: Date }
  | { type: "valuation"; amountMinor: bigint; occurredAt: Date; createdAt?: Date };

function eventPriority(type: InventoryEvent["type"]): number {
  if (type === "purchase") return 0;
  if (type === "inventory_expense") return 1;
  if (type === "sale") return 2;
  if (type === "sale_expense") return 3;
  return 4;
}

function accountingDate(primary?: Date, fallback?: Date): Date {
  if (primary instanceof Date && !Number.isNaN(primary.getTime())) return primary;
  if (fallback instanceof Date && !Number.isNaN(fallback.getTime())) return fallback;
  return new Date(0);
}

function allocateAverageCost(totalCost: bigint, totalQuantity: number, soldQuantity: number): bigint {
  if (soldQuantity === totalQuantity) return totalCost;
  return (totalCost * BigInt(soldQuantity) + BigInt(Math.floor(totalQuantity / 2))) / BigInt(totalQuantity);
}

function currencyEvents(history: PositionHistory, currency: string): InventoryEvent[] {
  const transactions = history.transactions;
  const expenses = history.expenses.filter((row) => normalizeCurrency(row.currency) === currency);
  return [
    ...transactions.map((row): InventoryEvent => ({
      type: row.kind === "sale" ? "sale" : "purchase",
      amountMinor: paymentComponents(row).filter((payment) => payment.currency === currency).reduce((sum, payment) => sum + payment.amountMinor, 0n),
      quantity: row.quantity ?? 1,
      occurredAt: accountingDate(row.occurredAt, row.createdAt),
      createdAt: row.createdAt
    })),
    ...expenses.map((row): InventoryEvent => ({
      type: row.context === "sale" ? "sale_expense" : "inventory_expense",
      amountMinor: row.amountMinor,
      occurredAt: accountingDate(row.occurredAt, row.createdAt),
      createdAt: row.createdAt
    })),
    ...(history.valuations ?? [])
      .filter((row) => row.available !== false && normalizeCurrency(row.currency) === currency)
      .map((row): InventoryEvent => ({
        type: "valuation",
        amountMinor: row.amountMinor,
        occurredAt: accountingDate(row.valuedAt, row.createdAt),
        createdAt: row.createdAt
      }))
  ].sort((left, right) => left.occurredAt.getTime() - right.occurredAt.getTime()
    || eventPriority(left.type) - eventPriority(right.type)
    || (left.createdAt?.getTime() ?? 0) - (right.createdAt?.getTime() ?? 0));
}

export function calculateCurrencyPosition(history: PositionHistory, currencyValue: string): CurrencyPosition {
  const currency = normalizeCurrency(currencyValue);
  const expenses = history.expenses.filter((row) => normalizeCurrency(row.currency) === currency);
  const events = currencyEvents(history, currency)
    .filter((event): event is Exclude<InventoryEvent, { type: "sale_expense" | "valuation" }> =>
      event.type !== "sale_expense" && event.type !== "valuation");

  let purchasedQuantity = 0;
  let soldQuantity = 0;
  let remainingQuantity = history.transactions.length === 0 ? Math.max(0, history.holdingQuantity ?? 0) : 0;
  let purchaseAmountMinor = BigInt(0);
  let inventoryExpenseMinor = BigInt(0);
  let remainingCostMinor = BigInt(0);
  let realizedCostMinor = BigInt(0);
  let grossSaleAmountMinor = BigInt(0);

  for (const event of events) {
    if (event.type === "inventory_expense") {
      inventoryExpenseMinor += event.amountMinor;
      if (remainingQuantity > 0 || purchasedQuantity === 0) remainingCostMinor += event.amountMinor;
      else realizedCostMinor += event.amountMinor;
      continue;
    }
    if (!Number.isInteger(event.quantity) || event.quantity <= 0) {
      throw new Error("交易数量必须是正整数。");
    }
    if (event.type === "purchase") {
      purchasedQuantity += event.quantity;
      remainingQuantity += event.quantity;
      purchaseAmountMinor += event.amountMinor;
      remainingCostMinor += event.amountMinor;
      continue;
    }
    if (event.quantity > remainingQuantity) {
      throw new Error(`出售数量超过当前 ${currency} 持仓（可售 ${remainingQuantity} 张）。`);
    }
    const allocatedCost = allocateAverageCost(remainingCostMinor, remainingQuantity, event.quantity);
    soldQuantity += event.quantity;
    remainingQuantity -= event.quantity;
    grossSaleAmountMinor += event.amountMinor;
    realizedCostMinor += allocatedCost;
    remainingCostMinor -= allocatedCost;
  }

  const saleExpenseMinor = expenses
    .filter((row) => row.context === "sale")
    .reduce((sum, row) => sum + row.amountMinor, BigInt(0));
  const netSaleAmountMinor = grossSaleAmountMinor - saleExpenseMinor;
  const latest = selectLatestValuation(history.valuations ?? [], currency);
  const costComplete = history.transactions.some((row) => row.kind === "purchase")
    && history.transactions.every((row) => row.amountKnown !== false)
    && history.expenses.every((row) => row.amountKnown !== false);
  const profitComplete = costComplete && history.transactions.every((row) => paymentComponents(row).every((payment) => payment.currency === currency || payment.amountMinor === 0n))
    && history.expenses.every((row) => row.currency === currency || row.amountMinor === 0n);
  const latestUnitValueMinor = latest?.amountMinor ?? null;
  const currentValueMinor = latestUnitValueMinor === null ? null : latestUnitValueMinor * BigInt(remainingQuantity);
  const unrealizedProfitMinor = !profitComplete || currentValueMinor === null ? null : currentValueMinor - remainingCostMinor;
  const realizedProfitMinor = netSaleAmountMinor - realizedCostMinor;
  const purchaseExpenseMinor = expenses
    .filter((row) => row.context === "purchase")
    .reduce((sum, row) => sum + row.amountMinor, BigInt(0));
  const gradingExpenseMinor = expenses
    .filter((row) => row.context !== "purchase" && row.context !== "sale")
    .reduce((sum, row) => sum + row.amountMinor, BigInt(0));

  return {
    costComplete,
    profitComplete,
    currency,
    purchasedQuantity,
    soldQuantity,
    remainingQuantity,
    purchaseAmountMinor,
    purchaseExpenseMinor,
    gradingExpenseMinor,
    inventoryExpenseMinor,
    saleExpenseMinor,
    grossSaleAmountMinor,
    netSaleAmountMinor,
    realizedCostMinor,
    remainingCostMinor,
    averageCostMinor: remainingQuantity > 0
      ? allocateAverageCost(remainingCostMinor, remainingQuantity, 1)
      : null,
    realizedProfitMinor,
    latestUnitValueMinor,
    currentValueMinor,
    unrealizedProfitMinor,
    totalProfitMinor: !profitComplete ? null : remainingQuantity === 0 ? realizedProfitMinor : unrealizedProfitMinor === null ? null : realizedProfitMinor + unrealizedProfitMinor
  };
}

export function calculatePositions(history: PositionHistory): CurrencyPosition[] {
  const currencies = new Set([
    ...history.transactions.flatMap((row) => paymentComponents(row).map((payment) => payment.currency)),
    ...history.expenses.map((row) => normalizeCurrency(row.currency)),
    ...(history.valuations ?? []).map((row) => normalizeCurrency(row.currency))
  ]);
  return [...currencies].sort().map((currency) => calculateCurrencyPosition(history, currency));
}
