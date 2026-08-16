"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { deriveLegacyFinancialSnapshot } from "@/lib/financial-history-snapshot";
import {
  createCardExpense,
  createCardTransaction,
  createCardValuation,
  deleteCardFinancialRecord,
  getCardFinancialHistory,
  updateCardExpense,
  updateCardTransaction,
  updateCardValuation
} from "@/lib/financial-history-store";
import { prisma } from "@/lib/prisma";
import { errorMessage } from "@/lib/feedback-messages";
import { normalizeReturnTo } from "@/lib/query-params";

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
  if (Number.isNaN(date.getTime())) throw new Error("日期无效。");
  return date;
}

function positiveInteger(formData: FormData, name: string): number {
  const value = Number(requiredText(formData, name, "数量"));
  if (!Number.isInteger(value) || value <= 0) throw new Error("数量必须是正整数。");
  return value;
}

async function mutateHistory(
  cardId: string,
  mutation: (transaction: Prisma.TransactionClient) => Promise<unknown>
) {
  await prisma.$transaction(async (transaction) => {
    await mutation(transaction);
    const history = await getCardFinancialHistory(transaction, cardId);
    await transaction.card.update({ where: { id: cardId }, data: deriveLegacyFinancialSnapshot(history) });
  });
}

function finishHistoryMutation(cardId: string, success: string, returnTo?: string, error?: unknown): never {
  revalidatePath("/");
  revalidatePath(`/cards/${cardId}`);
  revalidatePath("/showcase");
  revalidatePath(`/showcase/cards/${cardId}`);
  const preservedReturnTo = normalizeReturnTo(returnTo);
  const returnQuery = preservedReturnTo ? `&returnTo=${encodeURIComponent(preservedReturnTo)}` : "";
  if (error) {
    const message = errorMessage(error, "财务记录操作失败，请稍后重试。");
    redirect(`/cards/${cardId}?error=${encodeURIComponent(message)}${returnQuery}#financial-history`);
  }
  redirect(`/cards/${cardId}?success=${success}${returnQuery}#financial-history`);
}

export async function addTransactionAction(cardId: string, returnTo: string | undefined, formData: FormData): Promise<void> {
  try {
    await mutateHistory(cardId, (transaction) => createCardTransaction(transaction, {
        cardId,
        kind: requiredText(formData, "kind", "交易类型"),
        amount: requiredText(formData, "amount", "金额"),
        currency: requiredText(formData, "currency", "币种"),
        quantity: positiveInteger(formData, "quantity"),
        occurredAt: requiredDate(formData, "occurredAt"),
        source: optionalText(formData, "source"),
        notes: optionalText(formData, "notes")
      })
    );
  } catch (error) {
    finishHistoryMutation(cardId, "", returnTo, error);
  }
  finishHistoryMutation(cardId, "history-added", returnTo);
}

export async function addExpenseAction(cardId: string, returnTo: string | undefined, formData: FormData): Promise<void> {
  try {
    await mutateHistory(cardId, (transaction) => createCardExpense(transaction, {
        cardId,
        kind: requiredText(formData, "kind", "费用类型"),
        amount: requiredText(formData, "amount", "金额"),
        currency: requiredText(formData, "currency", "币种"),
        occurredAt: requiredDate(formData, "occurredAt"),
        vendor: optionalText(formData, "vendor"),
        notes: optionalText(formData, "notes")
      })
    );
  } catch (error) {
    finishHistoryMutation(cardId, "", returnTo, error);
  }
  finishHistoryMutation(cardId, "history-added", returnTo);
}

export async function addValuationAction(cardId: string, returnTo: string | undefined, formData: FormData): Promise<void> {
  try {
    await mutateHistory(cardId, (transaction) => createCardValuation(transaction, {
        cardId,
        amount: requiredText(formData, "amount", "金额"),
        currency: requiredText(formData, "currency", "币种"),
        valuedAt: requiredDate(formData, "valuedAt"),
        source: requiredText(formData, "source", "估值来源"),
        notes: optionalText(formData, "notes")
      })
    );
  } catch (error) {
    finishHistoryMutation(cardId, "", returnTo, error);
  }
  finishHistoryMutation(cardId, "history-added", returnTo);
}

export async function updateTransactionAction(cardId: string, recordId: string, returnTo: string | undefined, formData: FormData): Promise<void> {
  try {
    await mutateHistory(cardId, (transaction) => updateCardTransaction(transaction, cardId, recordId, {
      kind: requiredText(formData, "kind", "交易类型"),
      amount: requiredText(formData, "amount", "金额"),
      currency: requiredText(formData, "currency", "币种"),
      quantity: positiveInteger(formData, "quantity"),
      occurredAt: requiredDate(formData, "occurredAt"),
      source: optionalText(formData, "source"),
      notes: optionalText(formData, "notes")
      })
    );
  } catch (error) {
    finishHistoryMutation(cardId, "", returnTo, error);
  }
  finishHistoryMutation(cardId, "history-updated", returnTo);
}

export async function updateExpenseAction(cardId: string, recordId: string, returnTo: string | undefined, formData: FormData): Promise<void> {
  try {
    await mutateHistory(cardId, (transaction) => updateCardExpense(transaction, cardId, recordId, {
      kind: requiredText(formData, "kind", "费用类型"),
      amount: requiredText(formData, "amount", "金额"),
      currency: requiredText(formData, "currency", "币种"),
      occurredAt: requiredDate(formData, "occurredAt"),
      vendor: optionalText(formData, "vendor"),
      notes: optionalText(formData, "notes")
      })
    );
  } catch (error) {
    finishHistoryMutation(cardId, "", returnTo, error);
  }
  finishHistoryMutation(cardId, "history-updated", returnTo);
}

export async function updateValuationAction(cardId: string, recordId: string, returnTo: string | undefined, formData: FormData): Promise<void> {
  try {
    await mutateHistory(cardId, (transaction) => updateCardValuation(transaction, cardId, recordId, {
      amount: requiredText(formData, "amount", "金额"),
      currency: requiredText(formData, "currency", "币种"),
      valuedAt: requiredDate(formData, "valuedAt"),
      source: requiredText(formData, "source", "估值来源"),
      notes: optionalText(formData, "notes")
      })
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
