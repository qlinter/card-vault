import assert from "node:assert/strict";
import test from "node:test";
import { calculateOwnedCardsValue, isOwnedCollectionStatus } from "../lib/card-stats.ts";

test("owned collection statuses match the homepage value rule", () => {
  assert.equal(isOwnedCollectionStatus("holding"), true);
  assert.equal(isOwnedCollectionStatus("listed"), true);
  assert.equal(isOwnedCollectionStatus("grading"), true);
  assert.equal(isOwnedCollectionStatus("sold"), false);
  assert.equal(isOwnedCollectionStatus("target"), false);
});

test("homepage value excludes sold and target cards", () => {
  const total = calculateOwnedCardsValue([
    { collectionStatus: "holding", currentValue: 100 },
    { collectionStatus: "listed", currentValue: 200 },
    { collectionStatus: "grading", currentValue: 300 },
    { collectionStatus: "sold", currentValue: 400 },
    { collectionStatus: "target", currentValue: 500 },
    { collectionStatus: "holding", currentValue: null }
  ]);

  assert.equal(total, 600);
});
