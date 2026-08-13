import assert from "node:assert/strict";
import test from "node:test";
import { homeCardInclude, portfolioAnalysisCardSelect } from "../lib/card-query-shapes.ts";

test("homepage query loads only the latest valuation and omits full financial history", () => {
  assert.equal("transactions" in homeCardInclude, false);
  assert.equal("expenses" in homeCardInclude, false);
  assert.equal(homeCardInclude.valuations.take, 1);
  assert.deepEqual(homeCardInclude.valuations.orderBy, [{ valuedAt: "desc" }, { createdAt: "desc" }]);
});

test("portfolio analysis query retains the history required by the v2 snapshot", () => {
  assert.ok(portfolioAnalysisCardSelect.transactions);
  assert.ok(portfolioAnalysisCardSelect.expenses);
  assert.ok(portfolioAnalysisCardSelect.valuations);
  assert.ok(portfolioAnalysisCardSelect._count);
});
