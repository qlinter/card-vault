import assert from "node:assert/strict";
import test from "node:test";
import { valuationCoverage, portfolioSummaryMetrics } from "../lib/portfolio-metrics.ts";
import { createPortfolioBatchAccumulator } from "../lib/portfolio-batch.ts";
import { hasOptionalCardData } from "../lib/card-form-display.ts";

test("coverage keeps the holdings denominator and an empty collection has no percentage", () => {
  assert.deepEqual(valuationCoverage(1, 2), { valuedCount: 1, eligibleCount: 2, percent: 50, complete: false });
  assert.equal(valuationCoverage(0, 0).percent, null);
  assert.equal(valuationCoverage(0, 0).complete, false);
});

test("summary metrics preserve a known zero quote and keep missing quotes unknown", () => {
  const quote = { amountMinor: 0n, currency: "CNY", source: "test", valuedAt: new Date("2026-01-01"), createdAt: new Date("2026-01-01") };
  const make = (valuations: typeof quote[]) => {
    const accumulator = createPortfolioBatchAccumulator({ isFiltered: false, criteria: [] }, { reportingCurrency: "CNY", rates: [] }, new Date("2026-10-24"), undefined, { includeDetails: false });
    accumulator.add([{ playerName: "N", cardTitle: "T", sport: "Basketball", collectionStatus: "holding", holdingQuantity: 1, gradingCompany: null, grade: null, isRookie: false, isAutograph: false, isPatch: false, transactions: [], expenses: [], valuations }]);
    return portfolioSummaryMetrics(accumulator.finish().snapshot, "CNY");
  };
  assert.equal(make([quote])[0].value, 0);
  assert.equal(make([])[0].value, null);
});

test("optional field sections reveal existing data and honor values cleared in a restored form", () => {
  assert.equal(hasOptionalCardData(undefined, { grade: "10" }, ["grade"]), true);
  assert.equal(hasOptionalCardData({ grade: "" }, { grade: "10" }, ["grade"]), false);
  assert.equal(hasOptionalCardData({ isRookie: false }, { isRookie: true }, ["isRookie"]), false);
  assert.equal(hasOptionalCardData({ notes: "  " }, undefined, ["notes"]), false);
});
