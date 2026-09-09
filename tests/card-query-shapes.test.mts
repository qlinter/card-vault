import assert from "node:assert/strict";
import test from "node:test";
import { financialCardSelect, portfolioAnalysisCardSelect } from "../lib/card-query-shapes.ts";

test("report-index query retains complete currency and payment facts without image or text payloads", () => {
  assert.equal(financialCardSelect.transactions.select.paymentsJson, true);
  assert.equal(financialCardSelect.transactions.select.amountKnown, true);
  assert.equal(financialCardSelect.expenses.select.currency, true);
  assert.equal(financialCardSelect.valuations.select.currency, true);
  assert.equal("take" in financialCardSelect.valuations, false);
  assert.equal("images" in financialCardSelect, false);
  assert.equal("notes" in financialCardSelect, false);
});

test("portfolio analysis query retains the history required by the v2 snapshot", () => {
  assert.ok(portfolioAnalysisCardSelect.transactions);
  assert.equal(portfolioAnalysisCardSelect.id, true);
  assert.ok(portfolioAnalysisCardSelect.expenses);
  assert.ok(portfolioAnalysisCardSelect.valuations);
  assert.ok(portfolioAnalysisCardSelect._count);
});
