import { transactionDate } from "./financial-business-day.ts";
import type { Prisma, PrismaClient } from "@prisma/client";
import { assertFinancialVersion, financialConflictMessage } from "./record-version.ts";
import {
  isGift,
  assertExpenseKind,
  assertExpenseContext,
  assertHistoryDate,
  assertTransactionKind,
  assertValuationSource,
  moneyValue,
  normalizeOptionalHistoryText,
  type ExpenseKind,
  type ExpenseContext,
  type TransactionKind
} from "./financial-history.ts";

type HistoryClient = Pick<PrismaClient, "cardTransaction" | "cardExpense" | "cardValuation"> | Prisma.TransactionClient;

export type CreateTransactionInput = {
  cardId: string;
  kind: TransactionKind | string;
  amount: string | number;
  currency?: string;
  quantity?: number;
  amountKnown?: boolean;
  occurredAt: Date;
  source?: string | null;
  notes?: string | null;
  provenance?: string;
  externalKey?: string | null;
};

export type CreateExpenseInput = {
  cardId: string;
  kind: ExpenseKind | string;
  context: ExpenseContext | string;
  amount: string | number;
  currency?: string;
  occurredAt: Date;
  vendor?: string | null;
  notes?: string | null;
  provenance?: string;
  externalKey?: string | null;
};

export type CreateValuationInput = {
  cardId: string;
  amount: string | number;
  currency?: string;
  valuedAt: Date;
  source: string;
  notes?: string | null;
  provenance?: string;
  externalKey?: string | null;
};

export type UpdateTransactionInput = Omit<CreateTransactionInput, "cardId" | "provenance" | "externalKey">;
export type UpdateExpenseInput = Omit<CreateExpenseInput, "cardId" | "provenance" | "externalKey">;
export type UpdateValuationInput = Omit<CreateValuationInput, "cardId" | "provenance" | "externalKey">;

function transactionQuantity(quantity = 1) {
  if (!Number.isInteger(quantity) || quantity <= 0) throw new Error("交易数量必须是正整数。");
  return quantity;
}

function paymentData(input: CreateTransactionInput | UpdateTransactionInput) {
  if (isGift(input.kind)) return {amountMinor:0n,currency:"CNY",amountKnown:true,paymentsJson:null};
  const money = moneyValue(input);
  return { ...money, amountKnown: input.amountKnown !== false, paymentsJson: null };
}

export async function createCardTransaction(client: HistoryClient, input: CreateTransactionInput) {
  const money = paymentData(input);
  const quantity = transactionQuantity(input.quantity);
  return client.cardTransaction.create({
    data: {
      cardId: input.cardId,
      kind: assertTransactionKind(input.kind),
      ...money,
      quantity,
      occurredAt: transactionDate(input.occurredAt),
      source: normalizeOptionalHistoryText(input.source),
      notes: normalizeOptionalHistoryText(input.notes),
      provenance: normalizeOptionalHistoryText(input.provenance) ?? "manual",
      externalKey: normalizeOptionalHistoryText(input.externalKey)
    }
  });
}

function expenseData(input: UpdateExpenseInput) {
  const context = assertExpenseContext(input.context);
  const money = moneyValue(input);
  return {
    kind: assertExpenseKind(input.kind), context, ...money,
    occurredAt: assertHistoryDate(input.occurredAt),
    vendor: normalizeOptionalHistoryText(input.vendor), notes: normalizeOptionalHistoryText(input.notes)
  };
}

function valuationData(input: UpdateValuationInput) {
  const source = assertValuationSource(input.source.trim());
  return { ...moneyValue(input), valuedAt: assertHistoryDate(input.valuedAt), source, notes: normalizeOptionalHistoryText(input.notes) };
}

export async function createCardExpense(client: HistoryClient, input: CreateExpenseInput) {
  return client.cardExpense.create({
    data: {
      cardId: input.cardId,
      ...expenseData(input),
      provenance: normalizeOptionalHistoryText(input.provenance) ?? "manual",
      externalKey: normalizeOptionalHistoryText(input.externalKey)
    }
  });
}

export async function createCardValuation(client: HistoryClient, input: CreateValuationInput) {
  return client.cardValuation.create({
    data: {
      cardId: input.cardId,
      ...valuationData(input),
      provenance: normalizeOptionalHistoryText(input.provenance) ?? "manual",
      externalKey: normalizeOptionalHistoryText(input.externalKey)
    }
  });
}

export async function updateCardTransaction(
  client: HistoryClient,
  cardId: string,
  recordId: string,
  input: UpdateTransactionInput,
  expectedVersion: string
) {
  const kind = assertTransactionKind(input.kind);
  const quantity = transactionQuantity(input.quantity);
  const existing = await client.cardTransaction.findFirst({ where: { id: recordId, cardId } });
  // Callers mutate inside a SQLite transaction: concurrent snapshot writes cannot
  // commit. Compare content here rather than filtering Date columns, since valid
  // databases can contain SQLite text dates as well as Prisma millisecond dates.
  if (!existing) throw new Error("交易记录不存在或已删除。");
  assertFinancialVersion(existing, expectedVersion);
  const keepUnknown = !isGift(kind) && input.amount === "";
  if (keepUnknown && (existing.amountKnown || kind !== existing.kind || input.currency !== existing.currency)) throw new Error("金额不能为空。");
  const money = keepUnknown
    ? { amountMinor: existing.amountMinor, currency: existing.currency, amountKnown: false }
    : paymentData(input);
  // Keep historical payment facts when the simplified editor submits only one amount.
  if (!isGift(kind) && existing.paymentsJson && existing.paymentsJson !== "[]" && money.currency !== existing.currency) throw new Error("历史交易包含多币种金额，不能直接更改币种。");
  const result = await client.cardTransaction.updateMany({
    where: { id: recordId, cardId },
    data: {
      kind,
      ...money,
      paymentsJson: isGift(kind) ? null : existing.paymentsJson,
      quantity,
      occurredAt: transactionDate(input.occurredAt),
      source: normalizeOptionalHistoryText(input.source),
      notes: normalizeOptionalHistoryText(input.notes),
      provenance: "manual_correction"
    }
  });
  if (result.count !== 1) throw new Error(financialConflictMessage);
}

export async function updateCardExpense(client: HistoryClient, cardId: string, recordId: string, input: UpdateExpenseInput, expectedVersion: string) {
  const existing = await client.cardExpense.findFirst({ where: { id: recordId, cardId } });
  assertFinancialVersion(existing, expectedVersion);
  const result = await client.cardExpense.updateMany({
    where: { id: recordId, cardId },
    data: {
      ...expenseData(input),
      provenance: "manual_correction"
    }
  });
  if (result.count !== 1) throw new Error(financialConflictMessage);
}

export async function updateCardValuation(client: HistoryClient, cardId: string, recordId: string, input: UpdateValuationInput, expectedVersion: string) {
  const existing = await client.cardValuation.findFirst({ where: { id: recordId, cardId } });
  assertFinancialVersion(existing, expectedVersion);
  const result = await client.cardValuation.updateMany({
    where: { id: recordId, cardId },
    data: {
      ...valuationData(input),
      provenance: "manual_correction"
    }
  });
  if (result.count !== 1) throw new Error(financialConflictMessage);
}

export async function deleteCardFinancialRecord(
  client: HistoryClient,
  cardId: string,
  recordType: "transaction" | "expense" | "valuation",
  recordId: string,
  expectedVersion: string
) {
  const existing = recordType === "transaction" ? await client.cardTransaction.findFirst({ where: { id: recordId, cardId } })
    : recordType === "expense" ? await client.cardExpense.findFirst({ where: { id: recordId, cardId } })
      : await client.cardValuation.findFirst({ where: { id: recordId, cardId } });
  assertFinancialVersion(existing, expectedVersion);
  const where = { id: recordId, cardId };
  const result = recordType === "transaction"
    ? await client.cardTransaction.deleteMany({ where })
    : recordType === "expense"
      ? await client.cardExpense.deleteMany({ where })
      : await client.cardValuation.deleteMany({ where });
  if (result.count !== 1) throw new Error(financialConflictMessage);
}

export async function getCardFinancialHistory(client: HistoryClient, cardId: string) {
  const [transactions, expenses, valuations] = await Promise.all([
    client.cardTransaction.findMany({ where: { cardId }, orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }] }),
    client.cardExpense.findMany({ where: { cardId }, orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }] }),
    client.cardValuation.findMany({ where: { cardId }, orderBy: [{ valuedAt: "desc" }, { createdAt: "desc" }] })
  ]);
  return { transactions, expenses, valuations };
}
