import assert from "node:assert/strict";
import test from "node:test";
import {
  restoreHomeGridVisibleCount,
  saveHomeGridVisibleCount
} from "../lib/home-card-grid-state.ts";

test("home grid history preserves framework state and restores the matching list", () => {
  const saved = saveHomeGridVisibleCount({ __NA: true, tree: "next-state" }, "/?sport=Basketball", 48);

  assert.equal(saved.__NA, true);
  assert.equal(saved.tree, "next-state");
  assert.equal(restoreHomeGridVisibleCount(saved, "/?sport=Basketball", 91), 48);
  assert.equal(restoreHomeGridVisibleCount(saved, "/?sport=Football", 91), null);
});

test("home grid history rejects invalid values and clamps restored counts", () => {
  assert.equal(restoreHomeGridVisibleCount(null, "/", 91), null);
  assert.equal(restoreHomeGridVisibleCount({ cardVaultHomeGrid: { key: "/", visibleCount: "48" } }, "/", 91), null);

  const saved = saveHomeGridVisibleCount(null, "/", 72);
  assert.equal(restoreHomeGridVisibleCount(saved, "/", 50), 50);
});
