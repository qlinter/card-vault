import assert from "node:assert/strict";
import test from "node:test";
import { isOwnedCollectionStatus } from "../lib/card-stats.ts";

test("owned collection statuses remain available for portfolio analysis", () => {
  assert.equal(isOwnedCollectionStatus("holding"), true);
  assert.equal(isOwnedCollectionStatus("listed"), true);
  assert.equal(isOwnedCollectionStatus("grading"), true);
  assert.equal(isOwnedCollectionStatus("sold"), false);
  assert.equal(isOwnedCollectionStatus("target"), false);
});
