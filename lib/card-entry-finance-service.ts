import { localBusinessDay } from "./financial-business-day.ts";
import "server-only";
import type { CardFormValues } from "./card-form-values";
import { optionalCardDate } from "./card-domain";
import { normalizeCurrency, normalizeOptionalHistoryText } from "./financial-history";
import { calculatePositions, resolvePositionCollectionStatus } from "./position-accounting";
import type { Prisma } from "@prisma/client";
import { parseEntryFinance } from "./card-entry-finance.ts";
import { transactionInput, expenseInput, valuationInput } from "./financial-history-input.ts";
import { createCardTransaction, createCardExpense, createCardValuation, getCardFinancialHistory } from "./financial-history-store.ts";

async function createEntryFinancialRecords(client: Prisma.TransactionClient, cardId: string, json: string) {
  const records = parseEntryFinance(json);
  const formFor = (values: Record<string, string>) => {
    const form = new FormData();
    for (const [key, value] of Object.entries(values)) form.set(key, value);
    return form;
  };
  for (const record of records) {
    const form = formFor(record.values);
    if (record.type === "transaction") {
      await createCardTransaction(client, { cardId, ...transactionInput(form), provenance: "initial_card_entry" });
    } else if (record.type === "valuation") {
      await createCardValuation(client, { cardId, ...valuationInput(form), provenance:"initial_card_entry" });
    } else {
      await createCardExpense(client, { cardId, ...expenseInput(form), provenance:"initial_card_entry" });
    }
  }
  return records.length;
}

export async function createInitialFinancialHistory(
  transaction: Prisma.TransactionClient,
  cardId: string,
  values: CardFormValues,
  gradingCompany: string | null,
  quantity: number
) {
  const gift = values.acquisitionMethod === "gift_in";
  if (values.acquisitionMethod && !gift && values.acquisitionMethod !== "purchase") throw new Error("取得方式无效。");
  if (gift && (!values.purchaseDate || quantity < 1)) throw new Error("获赠需要填写日期和正数数量。");
  const purchaseAmount = gift ? "0" : normalizeOptionalHistoryText(values.purchasePrice);
  const gradingAmount = normalizeOptionalHistoryText(values.gradingFee);
  const valuationAmount = normalizeOptionalHistoryText(values.currentValue);
  const purchaseDate = optionalCardDate(values.purchaseDate, "购买日期");
  const valuationDate = optionalCardDate(values.valuationDate, "估值日期");
  const currency = normalizeCurrency(normalizeOptionalHistoryText(values.historyCurrency));
  const valuationSource = normalizeOptionalHistoryText(values.valuationSource);
  if ((purchaseAmount || gradingAmount || quantity > 1) && !purchaseDate) {
    throw new Error("填写购买价格、评级费用或多张初始数量时，必须填写购买日期。");
  }
  if (purchaseAmount && quantity === 0) throw new Error("初始数量为 0 时不能填写购买价格。");
  if (valuationAmount && !valuationDate) {
    throw new Error("填写初始估值时，必须填写估值日期。");
  }
  if (valuationAmount && !valuationSource) {
    throw new Error("填写初始估值时，必须注明估值来源。");
  }

  if (quantity > 0) {
    await createCardTransaction(transaction, {
      cardId,
      kind: gift ? "gift_in" : "purchase",
      amount: purchaseAmount ?? "0",
      amountKnown: purchaseAmount !== null,
      currency,
      quantity,
      occurredAt: purchaseDate ?? localBusinessDay(),
      source: normalizeOptionalHistoryText(values.purchaseSource),
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
      ...(history.transactions.length ? { holdingQuantity: calculatePositions(history)[0]?.remainingQuantity ?? 0 } : {}),
      ...(addedRecords ? { collectionStatus: resolvePositionCollectionStatus(values.collectionStatus, history) } : {})
    }
  });
}

