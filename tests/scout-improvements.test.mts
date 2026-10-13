import test from "node:test";
import assert from "node:assert/strict";
import { matchesSearch, searchTerms } from "../lib/search-terms.ts";
import { scoutTargetCount, wishProgressStatus } from "../lib/scout-domain.ts";
import { defaultWishView, wishViewForTarget } from "../lib/scout-view.ts";
test("linked wishes reveal the correct status and page while retaining sort preferences", () => {
  const rows = Array.from({ length: 41 }, (_, i) => ({ id: String(i), status: i === 40 ? "cancelled" : i === 39 ? "acquired" : "planned" }));
  const view = { ...defaultWishView, search: "hidden target", sort: "target" };
  assert.deepEqual(wishViewForTarget(rows, 20, "39", view), { ...view, search: "", acquired: true, page: 2 });
  assert.deepEqual(wishViewForTarget(rows, 20, "40", view), { ...view, search: "", cancelledPage: 1 });
  assert.equal(wishViewForTarget(rows, 20, "missing", view), null);
});
test("multi-word search matches across fields and preserves Chinese, punctuation and repeated terms", () => {
  assert.deepEqual(searchTerms("  Jordan  GOLD Jordan\n2025 "), ["jordan", "gold", "2025"]);
  assert.ok(matchesSearch("Jordan · 2025 · 金签 #12 · PSA 10", "PSA Jordan #12 金签"));
  assert.equal(matchesSearch("Jordan · 2025 · Gold", "Jordan 2024"), false);
  assert.ok(matchesSearch("anything", ""));
});
test("optional collection targets enforce integer limits and partial progress", () => {
  for (const value of ["", null, undefined]) assert.equal(scoutTargetCount(value), null);
  assert.equal(scoutTargetCount("500"), 500);
  for (const value of [0, -1, 501, 2.5, "abc", true, [2], {}]) assert.throws(() => scoutTargetCount(value));
  assert.equal(wishProgressStatus(1, 2), "planned");
  assert.equal(wishProgressStatus(2, 2), "acquired");
  assert.equal(wishProgressStatus(3, 2), "acquired");
  assert.equal(wishProgressStatus(1, null), "acquired");
});
