import type { Prisma, PrismaClient } from "@prisma/client";
import {
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
  secondaryAmount?: string | number | null;
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
  transactionId?: string | null;
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

function paymentData(input: CreateTransactionInput | UpdateTransactionInput) {
  const money = moneyValue(input);
  const secondary = input.secondaryAmount === undefined || input.secondaryAmount === null || input.secondaryAmount === "" ? null
    : moneyValue({ amount: input.secondaryAmount, currency: money.currency === "CNY" ? "USD" : "CNY" });
  return { ...money, amountKnown: input.amountKnown !== false, paymentsJson: secondary ? JSON.stringify([{ currency: secondary.currency, amountMinor: String(secondary.amountMinor) }]) : null };
}

export async function createCardTransaction(client: HistoryClient, input: CreateTransactionInput) {
  const money = paymentData(input);
  const quantity = input.quantity ?? 1;
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new Error("交易数量必须是正整数。");
  }
  return client.cardTransaction.create({
    data: {
      cardId: input.cardId,
      kind: assertTransactionKind(input.kind),
      ...money,
      quantity,
      occurredAt: assertHistoryDate(input.occurredAt),
      source: normalizeOptionalHistoryText(input.source),
      notes: normalizeOptionalHistoryText(input.notes),
      provenance: normalizeOptionalHistoryText(input.provenance) ?? "manual",
      externalKey: normalizeOptionalHistoryText(input.externalKey)
    }
  });
}

export async function createCardExpense(client: HistoryClient, input: CreateExpenseInput) {
  const context = assertExpenseContext(input.context);
  const money = moneyValue(input);
  const transactionId = await resolveExpenseTransactionId(client, input.cardId, context, money.currency, input.transactionId);
  return client.cardExpense.create({
    data: {
      cardId: input.cardId,
      kind: assertExpenseKind(input.kind),
      context,
      transactionId,
      ...money,
      occurredAt: assertHistoryDate(input.occurredAt),
      vendor: normalizeOptionalHistoryText(input.vendor),
      notes: normalizeOptionalHistoryText(input.notes),
      provenance: normalizeOptionalHistoryText(input.provenance) ?? "manual",
      externalKey: normalizeOptionalHistoryText(input.externalKey)
    }
  });
}

export async function createCardValuation(client: HistoryClient, input: CreateValuationInput) {
  const source = assertValuationSource(input.source.trim());
  return client.cardValuation.create({
    data: {
      cardId: input.cardId,
      ...moneyValue(input),
      valuedAt: assertHistoryDate(input.valuedAt),
      source,
      notes: normalizeOptionalHistoryText(input.notes),
      provenance: normalizeOptionalHistoryText(input.provenance) ?? "manual",
      externalKey: normalizeOptionalHistoryText(input.externalKey)
    }
  });
}

export async function updateCardTransaction(
  client: HistoryClient,
  cardId: string,
  recordId: string,
  input: UpdateTransactionInput
) {
  const money = paymentData(input);
  const kind = assertTransactionKind(input.kind);
  const quantity = input.quantity ?? 1;
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new Error("交易数量必须是正整数。");
  }
  const linkedExpense = await client.cardExpense.findFirst({ where: { transactionId: recordId } });
  if (linkedExpense && kind !== "sale") {
    throw new Error("该出售记录已关联费用，不能改为买入。请先修改关联费用。");
  }
  const result = await client.cardTransaction.updateMany({
    where: { id: recordId, cardId },
    data: {
      kind,
      ...money,
      quantity,
      occurredAt: assertHistoryDate(input.occurredAt),
      source: normalizeOptionalHistoryText(input.source),
      notes: normalizeOptionalHistoryText(input.notes),
      provenance: "manual_correction"
    }
  });
  if (result.count !== 1) throw new Error("交易记录不存在或已删除。");
}

export async function updateCardExpense(client: HistoryClient, cardId: string, recordId: string, input: UpdateExpenseInput) {
  const context = assertExpenseContext(input.context);
  const money = moneyValue(input);
  const transactionId = await resolveExpenseTransactionId(client, cardId, context, money.currency, input.transactionId);
  const result = await client.cardExpense.updateMany({
    where: { id: recordId, cardId },
    data: {
      kind: assertExpenseKind(input.kind),
      context,
      transactionId,
      ...money,
      occurredAt: assertHistoryDate(input.occurredAt),
      vendor: normalizeOptionalHistoryText(input.vendor),
      notes: normalizeOptionalHistoryText(input.notes),
      provenance: "manual_correction"
    }
  });
  if (result.count !== 1) throw new Error("费用记录不存在或已删除。");
}

export async function updateCardValuation(client: HistoryClient, cardId: string, recordId: string, input: UpdateValuationInput) {
  const source = assertValuationSource(input.source.trim());
  const result = await client.cardValuation.updateMany({
    where: { id: recordId, cardId },
    data: {
      ...moneyValue(input),
      valuedAt: assertHistoryDate(input.valuedAt),
      source,
      notes: normalizeOptionalHistoryText(input.notes),
      provenance: "manual_correction"
    }
  });
  if (result.count !== 1) throw new Error("估值记录不存在或已删除。");
}

export async function deleteCardFinancialRecord(
  client: HistoryClient,
  cardId: string,
  recordType: "transaction" | "expense" | "valuation",
  recordId: string
) {
  if (recordType === "transaction") {
    const linkedExpense = await client.cardExpense.findFirst({ where: { transactionId: recordId, cardId } });
    if (linkedExpense) throw new Error("该出售记录仍有关联费用，请先修改或删除关联费用。");
  }
  const result = recordType === "transaction"
    ? await client.cardTransaction.deleteMany({ where: { id: recordId, cardId } })
    : recordType === "expense"
      ? await client.cardExpense.deleteMany({ where: { id: recordId, cardId } })
      : await client.cardValuation.deleteMany({ where: { id: recordId, cardId } });
  if (result.count !== 1) throw new Error("财务记录不存在或已删除。");
}

async function resolveExpenseTransactionId(
  client: HistoryClient,
  cardId: string,
  context: ExpenseContext,
  _currency: string,
  transactionIdValue: string | null | undefined
): Promise<string | null> {
  const transactionId = normalizeOptionalHistoryText(transactionIdValue);
  if (context !== "sale") return null;
  if (!transactionId) throw new Error("出售相关费用必须关联一笔具体出售记录。");
  const transaction = await client.cardTransaction.findFirst({
    where: { id: transactionId, cardId, kind: "sale" },
    select: { id: true }
  });
  if (!transaction) throw new Error("关联的出售记录不存在。");
  return transaction.id;
}

export async function getCardFinancialHistory(client: HistoryClient, cardId: string) {
  const [transactions, expenses, valuations] = await Promise.all([
    client.cardTransaction.findMany({ where: { cardId }, orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }] }),
    client.cardExpense.findMany({ where: { cardId }, orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }] }),
    client.cardValuation.findMany({ where: { cardId }, orderBy: [{ valuedAt: "desc" }, { createdAt: "desc" }] })
  ]);
  return { transactions, expenses, valuations };
}
