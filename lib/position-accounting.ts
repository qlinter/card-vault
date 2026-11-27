import { storedBusinessDay } from "./financial-business-day.ts";
import { isOutgoing, isIncoming, normalizeCurrency, selectLatestValuation } from "./financial-history.ts";
import { paymentComponents, type FinancialTransaction, type FinancialExpense, type FinancialValuation } from "./financial-reporting.ts";

export type PositionTransaction = FinancialTransaction;
export type PositionExpense = FinancialExpense;
export type PositionValuation = FinancialValuation & { available?: boolean };

export type CurrencyPosition = {
  costComplete: boolean;
  profitComplete: boolean;
  currency: string;
  purchasedQuantity: number;
  soldQuantity: number;
  receivedQuantity: number;
  givenQuantity: number;
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

export type HoldingSnapshot = {
  day: string;
  remainingQuantity: number;
  remainingCostMinor: bigint;
  quote: { day: string; unitMinor: bigint | null } | null;
  currentValueMinor: bigint | null;
};

type PositionHistory = {
  holdingQuantity?: number;
  transactions: readonly PositionTransaction[];
  expenses: readonly PositionExpense[];
  valuations?: readonly PositionValuation[];
};

type InventoryEvent =
  | { type: "purchase" | "sale" | "gift_in" | "gift_out"; amountMinor: bigint; quantity: number; occurredAt: Date; createdAt?: Date }
  | { type: "inventory_expense"; amountMinor: bigint; occurredAt: Date; createdAt?: Date }
  | { type: "sale_expense"; amountMinor: bigint; occurredAt: Date; createdAt?: Date }
  | { type: "valuation"; amountMinor: bigint; available?: boolean; occurredAt: Date; createdAt?: Date };

function eventPriority(type: InventoryEvent["type"]): number {
  if (isIncoming(type)) return 0;
  if (type === "inventory_expense") return 1;
  if (isOutgoing(type)) return 2;
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
      type: row.kind === "gift_in" || row.kind === "gift_out" || row.kind === "sale" ? row.kind : "purchase",
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
      .filter((row) => normalizeCurrency(row.currency) === currency)
      .map((row): InventoryEvent => ({
        type: "valuation",
        amountMinor: row.amountMinor,
        available: row.available,
        occurredAt: accountingDate(row.valuedAt, row.createdAt),
        createdAt: row.createdAt
      }))
  ].sort((left, right) => storedBusinessDay(left.occurredAt) - storedBusinessDay(right.occurredAt)
    || eventPriority(left.type) - eventPriority(right.type)
    || left.occurredAt.getTime() - right.occurredAt.getTime()
    || (left.createdAt?.getTime() ?? 0) - (right.createdAt?.getTime() ?? 0));
}

function applyInventoryEvent(
  state: { purchasedQuantity: number; remainingQuantity: number; remainingCostMinor: bigint; realizedCostMinor: bigint },
  event: InventoryEvent
): void {
  if (event.type === "inventory_expense") {
    if (state.remainingQuantity > 0 || state.purchasedQuantity === 0) state.remainingCostMinor += event.amountMinor;
    else state.realizedCostMinor += event.amountMinor;
    return;
  }
  if (event.type === "sale_expense" || event.type === "valuation") return;
  if (!Number.isInteger(event.quantity) || event.quantity <= 0) {
    throw new Error("交易数量必须是正整数。");
  }
  if (isIncoming(event.type)) {
    state.purchasedQuantity += event.quantity;
    state.remainingQuantity += event.quantity;
    state.remainingCostMinor += event.amountMinor;
    return;
  }
  if (event.quantity > state.remainingQuantity) {
    if (event.type === "gift_out") throw new Error(`赠送数量超过当前持仓（可赠送 ${state.remainingQuantity} 张）。`);
    throw new Error(`出售数量超过当前持仓（可售 ${state.remainingQuantity} 张）。`);
  }
  const allocatedCost = allocateAverageCost(state.remainingCostMinor, state.remainingQuantity, event.quantity);
  state.remainingQuantity -= event.quantity;
  state.remainingCostMinor -= allocatedCost;
  state.realizedCostMinor += allocatedCost;
}

/** Replay quantities in the same order as the financial timeline. */
export function chronologicalTrades<T extends { id?: string; kind: string; quantity?: number; occurredAt?: Date; createdAt?: Date }>(trades: readonly T[]) {
  const state = { purchasedQuantity: 0, remainingQuantity: 0, remainingCostMinor: 0n, realizedCostMinor: 0n };
  let previouslyPurchased = false;
  return [...trades].sort((a, b) => storedBusinessDay(accountingDate(a.occurredAt,a.createdAt)) - storedBusinessDay(accountingDate(b.occurredAt,b.createdAt))
    || Number(isOutgoing(a.kind)) - Number(isOutgoing(b.kind))
    || accountingDate(a.occurredAt,a.createdAt).getTime() - accountingDate(b.occurredAt,b.createdAt).getTime()
    || accountingDate(a.createdAt).getTime() - accountingDate(b.createdAt).getTime() || (a.id ?? "").localeCompare(b.id ?? "")).map(record => {
    const repurchased = record.kind === "purchase" && previouslyPurchased && !state.remainingQuantity;
    if (record.kind === "purchase") previouslyPurchased = true;
    applyInventoryEvent(state, { type: record.kind === "gift_out" ? "gift_out" : isOutgoing(record.kind) ? "sale" : "purchase", quantity: record.quantity ?? 1, amountMinor: 0n, occurredAt: accountingDate(record.occurredAt,record.createdAt) });
    return { record, remainingQuantity:state.remainingQuantity, repurchased, soldOut: record.kind === "sale" && !state.remainingQuantity };
  });
}

export function calculateHoldingSnapshots(history: PositionHistory, currencyValue: string): HoldingSnapshot[] {
  const currency = normalizeCurrency(currencyValue);
  const state = { purchasedQuantity: 0, remainingQuantity: history.transactions.length === 0 ? Math.max(0, history.holdingQuantity ?? 0) : 0, remainingCostMinor: BigInt(0), realizedCostMinor: BigInt(0) };
  const days = new Map<string, HoldingSnapshot>();
  let quote: HoldingSnapshot["quote"] = null;
  for (const event of currencyEvents(history, currency)) {
    applyInventoryEvent(state, event);
    const day = event.occurredAt.toISOString().slice(0, 10);
    if (event.type === "valuation") quote = { day, unitMinor: event.available === false ? null : event.amountMinor };
    days.set(day, {
      day, quote,
      remainingQuantity: state.remainingQuantity,
      remainingCostMinor: state.remainingCostMinor,
      currentValueMinor: quote?.unitMinor == null ? null : quote.unitMinor * BigInt(state.remainingQuantity)
    });
  }
  return [...days.values()];
}

export function calculateCurrencyPosition(history: PositionHistory, currencyValue: string): CurrencyPosition {
  const currency = normalizeCurrency(currencyValue);
  const expenses = history.expenses.filter((row) => normalizeCurrency(row.currency) === currency);
  const events = currencyEvents({ ...history, valuations: [] }, currency)
    .filter((event): event is Exclude<InventoryEvent, { type: "sale_expense" | "valuation" }> =>
      event.type !== "sale_expense" && event.type !== "valuation");

  let purchasedQuantity = 0, receivedQuantity = 0;
  let soldQuantity = 0, givenQuantity = 0;
  let remainingQuantity = history.transactions.length === 0 ? Math.max(0, history.holdingQuantity ?? 0) : 0;
  let purchaseAmountMinor = BigInt(0);
  let inventoryExpenseMinor = BigInt(0);
  let remainingCostMinor = BigInt(0);
  let realizedCostMinor = BigInt(0);
  let grossSaleAmountMinor = BigInt(0);

  for (const event of events) {
    if (event.type === "inventory_expense") {
      inventoryExpenseMinor += event.amountMinor;
      if (remainingQuantity > 0 || purchasedQuantity + receivedQuantity === 0) remainingCostMinor += event.amountMinor;
      else realizedCostMinor += event.amountMinor;
      continue;
    }
    if (!Number.isInteger(event.quantity) || event.quantity <= 0) {
      throw new Error("交易数量必须是正整数。");
    }
    if (isIncoming(event.type)) {
      if (event.type === "gift_in") receivedQuantity += event.quantity;
      else purchasedQuantity += event.quantity;
      remainingQuantity += event.quantity;
      purchaseAmountMinor += event.amountMinor;
      remainingCostMinor += event.amountMinor;
      continue;
    }
    if (event.quantity > remainingQuantity) {
      if (event.type === "gift_out") throw new Error(`赠送数量超过当前持仓（可赠送 ${remainingQuantity} 张）。`);
      throw new Error(`出售数量超过当前 ${currency} 持仓（可售 ${remainingQuantity} 张）。`);
    }
    const allocatedCost = allocateAverageCost(remainingCostMinor, remainingQuantity, event.quantity);
    if (event.type === "sale") soldQuantity += event.quantity;
    else givenQuantity += event.quantity;
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
  const costComplete = history.transactions.some((row) => isIncoming(row.kind))
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
    purchasedQuantity, receivedQuantity,
    soldQuantity, givenQuantity,
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

export function resolvePositionQuantity(
  position: (Pick<CurrencyPosition, "purchasedQuantity" | "soldQuantity" | "remainingQuantity"> & {receivedQuantity?:number}) | null | undefined,
  fallbackQuantity = 1
): number {
  return position && (position.purchasedQuantity > 0 || position.soldQuantity > 0 || (position.receivedQuantity ?? 0) > 0 || position.remainingQuantity > 0)
    ? position.remainingQuantity
    : Math.max(0, fallbackQuantity);
}

export function resolvePositionCollectionStatus(
  currentStatus: string,
  history: Pick<PositionHistory, "transactions" | "expenses">
): string {
  const last = chronologicalTrades(history.transactions).at(-1);
  if (!last) return currentStatus;
  if (!last.remainingQuantity) return last.record.kind === "gift_out" ? "gifted" : "sold";
  return currentStatus === "sold" || currentStatus === "gifted" ? "holding" : currentStatus;
}
