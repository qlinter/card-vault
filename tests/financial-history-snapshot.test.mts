import assert from "node:assert/strict";
import test from "node:test";
import type { CardExpense, CardTransaction, CardValuation } from "@prisma/client";
import { deriveLegacyFinancialSnapshot } from "../lib/financial-history-snapshot.ts";

const common = { cardId: "card-1", notes: null, externalKey: null, createdAt: new Date(), updatedAt: new Date() };

test("legacy snapshot is derived from CNY facts without mixing currencies", () => {
  const transactions = [
    { ...common, id: "p1", kind: "purchase", amountMinor: 10000n, currency: "CNY", quantity: 1, occurredAt: new Date("2025-01-02"), source: "dealer", provenance: "manual" },
    { ...common, id: "r1", kind: "refund", amountMinor: 1000n, currency: "CNY", quantity: 1, occurredAt: new Date("2025-01-03"), source: null, provenance: "manual" },
    { ...common, id: "p2", kind: "purchase", amountMinor: 99900n, currency: "USD", quantity: 1, occurredAt: new Date("2025-01-01"), source: "foreign", provenance: "manual" }
  ] as CardTransaction[];
  const expenses = [
    { ...common, id: "e1", kind: "grading", amountMinor: 2000n, currency: "CNY", occurredAt: new Date("2025-01-04"), vendor: "PSA", provenance: "manual" },
    { ...common, id: "e2", kind: "shipping", amountMinor: 500n, currency: "CNY", occurredAt: new Date("2025-01-04"), vendor: null, provenance: "manual" }
  ] as CardExpense[];
  const valuations = [
    { ...common, id: "v1", amountMinor: 18000n, currency: "CNY", valuedAt: new Date("2025-02-01"), source: "market", provenance: "manual" }
  ] as CardValuation[];

  assert.deepEqual(deriveLegacyFinancialSnapshot({ transactions, expenses, valuations }), {
    purchaseDate: new Date("2025-01-02"),
    purchasePrice: 90,
    gradingFee: 20,
    totalCost: 115,
    currentValue: 180,
    purchaseSource: "dealer"
  });
});
