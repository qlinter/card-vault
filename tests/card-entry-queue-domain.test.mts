import assert from "node:assert/strict";
import test from "node:test";
import {
  cardEntryQueueSide,
  groupCardEntryBatchFiles,
  normalizeCardEntryBatchLabel,
  normalizeCardEntryQueuePairingMode
} from "../lib/card-entry-queue-domain.ts";

test("batch images can be grouped as ordered front/back pairs", () => {
  assert.deepEqual(groupCardEntryBatchFiles(["a", "b", "c", "d", "e"], "pairs"), [
    ["a", "b"],
    ["c", "d"],
    ["e"]
  ]);
  assert.equal(cardEntryQueueSide(0), "front");
  assert.equal(cardEntryQueueSide(1), "back");
});

test("single-image mode and batch metadata are normalized", () => {
  assert.deepEqual(groupCardEntryBatchFiles([1, 2, 3], "single"), [[1], [2], [3]]);
  assert.equal(normalizeCardEntryQueuePairingMode("single"), "single");
  assert.equal(normalizeCardEntryQueuePairingMode("unknown"), "pairs");
  assert.equal(normalizeCardEntryBatchLabel("  Test Batch  "), "Test Batch");
  assert.equal(normalizeCardEntryBatchLabel(" "), null);
  assert.equal(normalizeCardEntryBatchLabel("x".repeat(130))?.length, 120);
});
