import assert from "node:assert/strict";
import test from "node:test";
import type { CardExpense, CardTransaction, CardValuation } from "@prisma/client";
import { deriveCardFinancialSummary } from "../lib/financial-history-snapshot.ts";

const common = { cardId: "card-1", notes: null, externalKey: null, createdAt: new Date(), updatedAt: new Date() };

test("card financial summary is derived from CNY facts without mixing currencies", () => {
  const transactions = [
    { ...common, id: "p1", kind: "purchase", amountMinor: 20000n, currency: "CNY", quantity: 2, occurredAt: new Date("2025-01-02"), source: "dealer", provenance: "manual" },
    { ...common, id: "s1", kind: "sale", amountMinor: 15000n, currency: "CNY", quantity: 1, occurredAt: new Date("2025-01-05"), source: "market", provenance: "manual" }
  ] as CardTransaction[];
  const expenses = [
    { ...common, id: "e1", kind: "grading", context: "grading", amountMinor: 2000n, currency: "CNY", occurredAt: new Date("2025-01-04"), vendor: "PSA", provenance: "manual" },
    { ...common, id: "e2", kind: "shipping", context: "purchase", amountMinor: 500n, currency: "CNY", occurredAt: new Date("2025-01-02"), vendor: null, provenance: "manual" }
  ] as CardExpense[];
  const valuations = [
    { ...common, id: "v1", amountMinor: 18000n, currency: "CNY", valuedAt: new Date("2025-02-01"), source: "market", provenance: "manual" }
  ] as CardValuation[];

  assert.deepEqual(deriveCardFinancialSummary({ transactions, expenses, valuations }), {
    purchaseDate: new Date("2025-01-02"),
    purchasePrice: 200,
    gradingFee: 20,
    totalCost: 112.5,
    currentValue: 180,
    purchaseSource: "dealer",
    holdingQuantity: 1
  });
});
