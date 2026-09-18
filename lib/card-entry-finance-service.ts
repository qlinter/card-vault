import "server-only";
import type { CardFormValues } from "./card-form-values";
import { optionalCardDate } from "./card-domain";
import { normalizeCurrency } from "./financial-history";
import { deriveCardFinancialSummary } from "./financial-history-snapshot";
import { resolvePositionCollectionStatus } from "./position-accounting";
import type { Prisma } from "@prisma/client";
import { parseEntryFinance } from "./card-entry-finance.ts";
import { transactionInput, expenseInput, valuationInput } from "./financial-history-input.ts";
import { createCardTransaction, createCardExpense, createCardValuation, getCardFinancialHistory } from "./financial-history-store.ts";

async function createEntryFinancialRecords(client: Prisma.TransactionClient, cardId: string, json: string) {
  const records = parseEntryFinance(json);
  const transactionIds = new Map<string, string>();
  const formFor = (values: Record<string, string>) => {
    const form = new FormData();
    for (const [key, value] of Object.entries(values)) form.set(key, value);
    return form;
  };
  // Resolve in-memory sale references only after every submitted transaction exists.
  for (const record of records.filter(row => row.type === "transaction")) {
    const created = await createCardTransaction(client, { cardId, ...transactionInput(formFor(record.values)), provenance:"initial_card_entry" });
    transactionIds.set(record.id, created.id);
  }
  for (const record of records.filter(row => row.type !== "transaction")) {
    const form = formFor(record.values);
    if (record.type === "valuation") {
      await createCardValuation(client, { cardId, ...valuationInput(form), provenance:"initial_card_entry" });
    } else {
      if (record.values.context === "sale") {
        const id = transactionIds.get(record.values.transactionId || "");
        if (!id) throw new Error("出售相关费用必须关联本次录入的出售记录。");
        form.set("transactionId", id);
      }
      await createCardExpense(client, { cardId, ...expenseInput(form), provenance:"initial_card_entry" });
    }
  }
  return records.length;
}

function optionalString(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export async function createInitialFinancialHistory(
  transaction: Prisma.TransactionClient,
  cardId: string,
  values: CardFormValues,
  gradingCompany: string | null,
  quantity: number
) {
  const purchaseAmount = optionalString(values.purchasePrice);
  const secondaryAmount = optionalString(values.secondaryPurchasePrice ?? "");
  const gradingAmount = optionalString(values.gradingFee);
  const valuationAmount = optionalString(values.currentValue);
  const purchaseDate = optionalCardDate(values.purchaseDate, "购买日期");
  const valuationDate = optionalCardDate(values.valuationDate, "估值日期");
  const currency = normalizeCurrency(optionalString(values.historyCurrency));
  const valuationSource = optionalString(values.valuationSource);
  if ((purchaseAmount || secondaryAmount || gradingAmount || quantity > 1) && !purchaseDate) {
    throw new Error("填写购买价格、评级费用或多张初始数量时，必须填写购买日期。");
  }
  if ((purchaseAmount || secondaryAmount) && quantity === 0) throw new Error("初始数量为 0 时不能填写购买价格。");
  if (valuationAmount && !valuationDate) {
    throw new Error("填写初始估值时，必须填写估值日期。");
  }
  if (valuationAmount && !valuationSource) {
    throw new Error("填写初始估值时，必须注明估值来源。");
  }

  if (quantity > 0) {
    await createCardTransaction(transaction, {
      cardId,
      kind: "purchase",
      amount: purchaseAmount ?? "0",
      secondaryAmount,
      amountKnown: purchaseAmount !== null || secondaryAmount !== null,
      currency,
      quantity,
      occurredAt: purchaseDate ?? new Date(),
      source: optionalString(values.purchaseSource),
      provenance: "initial_card_entry"
    });
  }
  if (gradingAmount && purchaseDate) {
    await createCardExpense(transaction, {
      cardId,
      kind: "grading",
      context: "grading",
      amount: gradingAmount,
      currency,
      occurredAt: purchaseDate,
      vendor: gradingCompany,
      provenance: "initial_card_entry"
    });
  }
  if (valuationAmount && valuationDate && valuationSource) {
    await createCardValuation(transaction, {
      cardId,
      amount: valuationAmount,
      currency,
      valuedAt: valuationDate,
      source: valuationSource,
      provenance: "initial_card_entry"
    });
  }

  const addedRecords = await createEntryFinancialRecords(transaction, cardId, values.financialRecords || "[]");
  const history = await getCardFinancialHistory(transaction, cardId);
  await transaction.card.update({
    where: { id: cardId },
    data: {
      ...deriveCardFinancialSummary(history),
      ...(addedRecords ? { collectionStatus: resolvePositionCollectionStatus(values.collectionStatus, history) } : {})
    }
  });
}

