import assert from "node:assert/strict";
import test from "node:test";
import {
  moveId,
  normalizeCardOrder,
  parseShareEditorDraft,
  reorderIds,
  shareEditorDraftVersion
} from "../lib/share-editor-state.ts";

test("share editor ordering supports drag targets and keyboard movement", () => {
  assert.deepEqual(reorderIds(["a", "b", "c"], "a", "c"), ["b", "c", "a"]);
  assert.deepEqual(moveId(["a", "b", "c"], "b", -1), ["b", "a", "c"]);
  assert.deepEqual(moveId(["a", "b", "c"], "a", -1), ["a", "b", "c"]);
  assert.deepEqual(normalizeCardOrder(["c", "a"], {
    a: { sortOrder: "8", displayTitle: "A", displayDescription: "" },
    c: { sortOrder: "2", displayTitle: "C", displayDescription: "" }
  }), {
    a: { sortOrder: "2", displayTitle: "A", displayDescription: "" },
    c: { sortOrder: "1", displayTitle: "C", displayDescription: "" }
  });
});

test("share editor draft recovery drops unavailable cards and normalizes presentation", () => {
  const draft = parseShareEditorDraft(JSON.stringify({
    version: shareEditorDraftVersion,
    savedAt: "2026-08-12T00:00:00.000Z",
    snapshot: {
      selectedIds: ["a", "missing", "a"],
      drafts: { a: { sortOrder: "9", displayTitle: "恢复标题", displayDescription: "恢复说明" } },
      themeValues: { title: "恢复展馆" },
      theme: "archive",
      presentation: { layout: "arena", typography: "editorial", density: "compact", imageFit: "contain", textScale: "large" },
      sections: [{ id: "one", title: "章节", layout: "grid", cardIds: ["a", "missing"] }],
      coverMode: "custom"
    }
  }), ["a", "b"]);

  assert.ok(draft);
  assert.deepEqual(draft.snapshot.selectedIds, ["a"]);
  assert.equal(draft.snapshot.drafts.a.sortOrder, "1");
  assert.equal(draft.snapshot.presentation.typography, "editorial");
  assert.equal(draft.snapshot.presentation.density, "compact");
  assert.equal(draft.snapshot.presentation.imageFit, "contain");
  assert.equal(draft.snapshot.presentation.textScale, "large");
  assert.deepEqual(draft.snapshot.sections[0].cardIds, ["a"]);
});
