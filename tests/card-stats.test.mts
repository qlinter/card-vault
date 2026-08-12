import assert from "node:assert/strict";
import test from "node:test";
import { calculateLatestValuationTotals, isOwnedCollectionStatus } from "../lib/card-stats.ts";

test("owned collection statuses remain available for portfolio analysis", () => {
  assert.equal(isOwnedCollectionStatus("holding"), true);
  assert.equal(isOwnedCollectionStatus("listed"), true);
  assert.equal(isOwnedCollectionStatus("grading"), true);
  assert.equal(isOwnedCollectionStatus("sold"), false);
  assert.equal(isOwnedCollectionStatus("target"), false);
});

test("homepage totals use exactly one latest valuation from every selected card", () => {
  const result = calculateLatestValuationTotals([
    {
      valuations: [
        { amountMinor: 10000n, currency: "CNY", valuedAt: new Date("2025-01-01"), createdAt: new Date("2025-01-01") },
        { amountMinor: 15000n, currency: "CNY", valuedAt: new Date("2025-02-01"), createdAt: new Date("2025-02-01") }
      ]
    },
    { valuations: [{ amountMinor: 22000n, currency: "CNY", valuedAt: new Date("2025-01-05"), createdAt: new Date("2025-01-05") }] },
    { valuations: [{ amountMinor: 9950n, currency: "USD", valuedAt: new Date("2025-01-06"), createdAt: new Date("2025-01-06") }] },
    { valuations: [] }
  ]);

  assert.deepEqual(result, {
    totals: { CNY: 37000n, USD: 9950n },
    valuedCardCount: 3
  });
});
