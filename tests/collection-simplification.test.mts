import assert from "node:assert/strict";
import test from "node:test";
import { includeFollowUpTask } from "../lib/collection-review.ts";
import { restoreCollectionExport, saveCollectionExport } from "../lib/collection-export-state.ts";

test("review follows status tasks and retains handled data reminders without duplicate open gaps", () => {
  for (const kind of ["grading", "listed"] as const) {
    assert.equal(includeFollowUpTask(kind, "open"), true);
    assert.equal(includeFollowUpTask(kind, "done", true), true);
  }
  for (const kind of ["images", "purchase", "valuation", "stale"] as const) {
    assert.equal(includeFollowUpTask(kind, "open", true), false);
    for (const state of ["done", "dismissed", "snoozed"]) {
      assert.equal(includeFollowUpTask(kind, state), false);
      assert.equal(includeFollowUpTask(kind, state, true), true);
    }
  }
});

test("export selection belongs to the exact applied scope and preserves navigation history", () => {
  const url = "/?team=A&isAutograph=false&export=1";
  const existing = { __NA: true, cardVaultVisible: { count: 48 }, other: 12 };
  const saved = saveCollectionExport(existing, { url, selected: ["a", "b"], publicOnly: true });
  assert.equal(saved.__NA, true);
  assert.deepEqual(saved.cardVaultVisible, { count: 48 });
  assert.deepEqual(restoreCollectionExport(saved, url), { url, selected: ["a", "b"], publicOnly: true });
  assert.deepEqual(restoreCollectionExport(saved, "/?team=B&export=1").selected, []);
  assert.deepEqual(existing, { __NA: true, cardVaultVisible: { count: 48 }, other: 12 });
  assert.deepEqual(restoreCollectionExport({ cardVaultCollectionExport: { url, selected: ["a", "a", null, 12, ""], publicOnly: "true" } }, url), { url, selected: ["a"], publicOnly: false });
});
