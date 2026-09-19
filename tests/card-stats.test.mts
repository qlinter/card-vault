import assert from "node:assert/strict";
import test from "node:test";
import { isOwnedCollectionStatus } from "../lib/card-stats.ts";
import { collectionStatusText } from "../lib/card-domain.ts";
import { buildPortfolioScope } from "../lib/portfolio-analysis-scope.ts";

test("owned collection statuses remain available for portfolio analysis", () => {
  assert.equal(isOwnedCollectionStatus("holding"), true);
  assert.equal(isOwnedCollectionStatus("pending_grading"), true);
  assert.equal(isOwnedCollectionStatus("listed"), true);
  assert.equal(isOwnedCollectionStatus("grading"), true);
  assert.equal(isOwnedCollectionStatus("sold"), false);
  assert.equal(isOwnedCollectionStatus("target"), false);
  assert.equal(isOwnedCollectionStatus("unknown"), false);
});

test("unrecognized filter labels cannot resolve Object prototype members", () => {
  for (const value of ["toString", "__proto__", "constructor", "unknown"]) {
    assert.equal(collectionStatusText(value), value);
    assert.deepEqual(buildPortfolioScope({ collectionStatus: value, visibility: value }).criteria.map(item => item.value), [value, value]);
  }
});
