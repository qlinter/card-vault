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
  updateCardValuation
} from "@/lib/financial-history-store";
import { transactionInput, expenseInput, valuationInput, optionalText } from "@/lib/financial-history-input";
import { prisma } from "@/lib/prisma";
import { errorMessage } from "@/lib/feedback-messages";
import { normalizeReturnTo } from "@/lib/query-params";
import { resolvePositionCollectionStatus } from "@/lib/position-accounting";

type FinancialRecordType = "transaction" | "expense" | "valuation";

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
