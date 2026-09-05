import assert from "node:assert/strict";
import test from "node:test";
import { homeCardInclude, portfolioAnalysisCardSelect } from "../lib/card-query-shapes.ts";

test("homepage query retains currency alternatives and payment history for unified reporting", () => {
  assert.equal("transactions" in homeCardInclude, true);
  assert.equal("expenses" in homeCardInclude, true);
  assert.equal("take" in homeCardInclude.valuations, false);
  assert.deepEqual(homeCardInclude.valuations.orderBy, [{ valuedAt: "desc" }, { createdAt: "desc" }]);
});

test("portfolio analysis query retains the history required by the v2 snapshot", () => {
  assert.ok(portfolioAnalysisCardSelect.transactions);
  assert.equal(portfolioAnalysisCardSelect.id, true);
  assert.ok(portfolioAnalysisCardSelect.expenses);
  assert.ok(portfolioAnalysisCardSelect.valuations);
  assert.ok(portfolioAnalysisCardSelect._count);
});
