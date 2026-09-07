"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { deriveCardFinancialSummary } from "@/lib/financial-history-snapshot";
import {
  createCardExpense,
  createCardTransaction,
  createCardValuation,
  deleteCardFinancialRecord,
  getCardFinancialHistory,
  updateCardExpense,
  updateCardTransaction,
  updateCardValuation,
  type UpdateExpenseInput,
  type UpdateTransactionInput,
  type UpdateValuationInput
} from "@/lib/financial-history-store";
import { prisma } from "@/lib/prisma";
import { errorMessage } from "@/lib/feedback-messages";
import { normalizeReturnTo } from "@/lib/query-params";
import { resolvePositionCollectionStatus } from "@/lib/position-accounting";

type FinancialRecordType = "transaction" | "expense" | "valuation";

function requiredText(formData: FormData, name: string, label: string): string {
  const value = formData.get(name);
  const trimmed = typeof value === "string" ? value.trim() : "";
  if (!trimmed) throw new Error(`${label}不能为空。`);
  return trimmed;
}

function optionalText(formData: FormData, name: string): string | null {
  const value = formData.get(name);
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed || null;
}

function requiredDate(formData: FormData, name: string): Date {
  const raw = requiredText(formData, name, "日期");
  const date = new Date(`${raw}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw) || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== raw) throw new Error("日期无效。");
  return date;
}

function positiveInteger(formData: FormData, name: string): number {
  const value = Number(requiredText(formData, name, "数量"));
  if (!Number.isInteger(value) || value <= 0) throw new Error("数量必须是正整数。");
  return value;
}

function transactionInput(formData: FormData): UpdateTransactionInput {
  return {
    kind: requiredText(formData, "kind", "交易类型"),
    amount: requiredText(formData, "amount", "金额"),
    currency: requiredText(formData, "currency", "币种"),
    quantity: positiveInteger(formData, "quantity"),
    secondaryAmount: optionalText(formData, "secondaryAmount"),
    amountKnown: formData.get("amountUnknown") !== "on",
    occurredAt: requiredDate(formData, "occurredAt"),
    source: optionalText(formData, "source"),
    notes: optionalText(formData, "notes")
  };
}

function expenseInput(formData: FormData): UpdateExpenseInput {
  return {
    kind: requiredText(formData, "kind", "费用类型"),
    context: requiredText(formData, "context", "费用归属"),
    transactionId: optionalText(formData, "transactionId"),
    amount: requiredText(formData, "amount", "金额"),
    currency: requiredText(formData, "currency", "币种"),
    occurredAt: requiredDate(formData, "occurredAt"),
    vendor: optionalText(formData, "vendor"),
    notes: optionalText(formData, "notes")
  };
}

function valuationInput(formData: FormData): UpdateValuationInput {
  return {
    amount: requiredText(formData, "amount", "金额"),
    currency: requiredText(formData, "currency", "币种"),
    valuedAt: requiredDate(formData, "valuedAt"),
    source: requiredText(formData, "source", "估值来源"),
    notes: optionalText(formData, "notes")
  };
}

async function mutateHistory(
  cardId: string,
  mutation: (transaction: Prisma.TransactionClient) => Promise<unknown>
) {
  await prisma.$transaction(async (transaction) => {
    await mutation(transaction);
    const history = await getCardFinancialHistory(transaction, cardId);
    const card = await transaction.card.findUniqueOrThrow({ where: { id: cardId }, select: { collectionStatus: true } });
    await transaction.card.update({
      where: { id: cardId },
      data: {
        ...deriveCardFinancialSummary(history),
        collectionStatus: resolvePositionCollectionStatus(card.collectionStatus, history)
      }
    });
  });
}

function finishHistoryMutation(cardId: string, success: string, returnTo?: string, error?: unknown): never {
  revalidatePath("/");
  revalidatePath(`/cards/${cardId}`);
  revalidatePath("/showcase");
  revalidatePath("/portfolio");
  revalidatePath(`/showcase/cards/${cardId}`);
  const preservedReturnTo = normalizeReturnTo(returnTo);
  const returnQuery = preservedReturnTo ? `&returnTo=${encodeURIComponent(preservedReturnTo)}` : "";
  if (error) {
    const message = errorMessage(error, "财务记录操作失败，请稍后重试。");
    redirect(`/cards/${cardId}?error=${encodeURIComponent(message)}${returnQuery}#financial-history`);
  }
  redirect(`/cards/${cardId}?success=${success}${returnQuery}#financial-history`);
}

export async function saveFinancialRecordFormAction(cardId: string, type: FinancialRecordType, recordId: string | null, returnTo: string | undefined, _previousState: { error: string }, formData: FormData): Promise<{ error: string }> {
  try {
    await mutateHistory(cardId, async (transaction) => {
      if (type === "transaction") return recordId ? updateCardTransaction(transaction, cardId, recordId, transactionInput(formData)) : createCardTransaction(transaction, { cardId, ...transactionInput(formData), externalKey: optionalText(formData, "submissionId") });
      if (type === "expense") return recordId ? updateCardExpense(transaction, cardId, recordId, expenseInput(formData)) : createCardExpense(transaction, { cardId, ...expenseInput(formData), externalKey: optionalText(formData, "submissionId") });
      return recordId ? updateCardValuation(transaction, cardId, recordId, valuationInput(formData)) : createCardValuation(transaction, { cardId, ...valuationInput(formData), externalKey: optionalText(formData, "submissionId") });
    });
  } catch (error) { return { error: errorMessage(error, "财务记录操作失败，请稍后重试。") }; }
  finishHistoryMutation(cardId, recordId ? "history-updated" : "history-added", returnTo);
}

export async function addTransactionAction(cardId: string, returnTo: string | undefined, formData: FormData): Promise<void> {
  try {
    await mutateHistory(cardId, (transaction) =>
      createCardTransaction(transaction, { cardId, ...transactionInput(formData), externalKey: optionalText(formData, "submissionId") })
    );
  } catch (error) {
    finishHistoryMutation(cardId, "", returnTo, error);
  }
  finishHistoryMutation(cardId, "history-added", returnTo);
}

export async function addExpenseAction(cardId: string, returnTo: string | undefined, formData: FormData): Promise<void> {
  try {
    await mutateHistory(cardId, (transaction) =>
      createCardExpense(transaction, { cardId, ...expenseInput(formData), externalKey: optionalText(formData, "submissionId") })
    );
  } catch (error) {
    finishHistoryMutation(cardId, "", returnTo, error);
  }
  finishHistoryMutation(cardId, "history-added", returnTo);
}

export async function addValuationAction(cardId: string, returnTo: string | undefined, formData: FormData): Promise<void> {
  try {
    await mutateHistory(cardId, (transaction) =>
      createCardValuation(transaction, { cardId, ...valuationInput(formData), externalKey: optionalText(formData, "submissionId") })
    );
  } catch (error) {
    finishHistoryMutation(cardId, "", returnTo, error);
  }
  finishHistoryMutation(cardId, "history-added", returnTo);
}

export async function updateTransactionAction(cardId: string, recordId: string, returnTo: string | undefined, formData: FormData): Promise<void> {
  try {
    await mutateHistory(cardId, (transaction) =>
      updateCardTransaction(transaction, cardId, recordId, transactionInput(formData))
    );
  } catch (error) {
    finishHistoryMutation(cardId, "", returnTo, error);
  }
  finishHistoryMutation(cardId, "history-updated", returnTo);
}

export async function updateExpenseAction(cardId: string, recordId: string, returnTo: string | undefined, formData: FormData): Promise<void> {
  try {
    await mutateHistory(cardId, (transaction) =>
      updateCardExpense(transaction, cardId, recordId, expenseInput(formData))
    );
  } catch (error) {
    finishHistoryMutation(cardId, "", returnTo, error);
  }
  finishHistoryMutation(cardId, "history-updated", returnTo);
}

export async function updateValuationAction(cardId: string, recordId: string, returnTo: string | undefined, formData: FormData): Promise<void> {
  try {
    await mutateHistory(cardId, (transaction) =>
      updateCardValuation(transaction, cardId, recordId, valuationInput(formData))
    );
  } catch (error) {
    finishHistoryMutation(cardId, "", returnTo, error);
  }
  finishHistoryMutation(cardId, "history-updated", returnTo);
}

export async function deleteFinancialRecordAction(
  cardId: string,
  recordType: FinancialRecordType,
  recordId: string,
  returnTo: string | undefined
): Promise<void> {
  try {
    await mutateHistory(cardId, (transaction) => deleteCardFinancialRecord(transaction, cardId, recordType, recordId));
  } catch (error) {
    finishHistoryMutation(cardId, "", returnTo, error);
  }
  finishHistoryMutation(cardId, "history-deleted", returnTo);
}
