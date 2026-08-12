import type { Prisma, PrismaClient } from "@prisma/client";
import {
  assertExpenseKind,
  assertHistoryDate,
  assertTransactionKind,
  assertValuationSource,
  moneyValue,
  normalizeOptionalHistoryText,
  type ExpenseKind,
  type TransactionKind
} from "./financial-history.ts";

type HistoryClient = Pick<PrismaClient, "cardTransaction" | "cardExpense" | "cardValuation"> | Prisma.TransactionClient;

export type CreateTransactionInput = {
  cardId: string;
  kind: TransactionKind | string;
  amount: string | number;
  currency?: string;
  quantity?: number;
  occurredAt: Date;
  source?: string | null;
  notes?: string | null;
  provenance?: string;
  externalKey?: string | null;
};

export type CreateExpenseInput = {
  cardId: string;
  kind: ExpenseKind | string;
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

export async function createCardTransaction(client: HistoryClient, input: CreateTransactionInput) {
  const money = moneyValue(input);
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
  return client.cardExpense.create({
    data: {
      cardId: input.cardId,
      kind: assertExpenseKind(input.kind),
      ...moneyValue(input),
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
  const money = moneyValue(input);
  const quantity = input.quantity ?? 1;
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new Error("交易数量必须是正整数。");
  }
  const result = await client.cardTransaction.updateMany({
    where: { id: recordId, cardId },
    data: {
      kind: assertTransactionKind(input.kind),
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
  const result = await client.cardExpense.updateMany({
    where: { id: recordId, cardId },
    data: {
      kind: assertExpenseKind(input.kind),
      ...moneyValue(input),
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
  const result = recordType === "transaction"
    ? await client.cardTransaction.deleteMany({ where: { id: recordId, cardId } })
    : recordType === "expense"
      ? await client.cardExpense.deleteMany({ where: { id: recordId, cardId } })
      : await client.cardValuation.deleteMany({ where: { id: recordId, cardId } });
  if (result.count !== 1) throw new Error("财务记录不存在或已删除。");
}

export async function getCardFinancialHistory(client: HistoryClient, cardId: string) {
  const [transactions, expenses, valuations] = await Promise.all([
    client.cardTransaction.findMany({ where: { cardId }, orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }] }),
    client.cardExpense.findMany({ where: { cardId }, orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }] }),
    client.cardValuation.findMany({ where: { cardId }, orderBy: [{ valuedAt: "desc" }, { createdAt: "desc" }] })
  ]);
  return { transactions, expenses, valuations };
}
