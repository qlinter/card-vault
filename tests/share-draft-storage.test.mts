import assert from "node:assert/strict";
import test from "node:test";
import { acknowledgeShareDraft, shareDraftStorageKey } from "../lib/share-draft-storage.ts";

test("share acknowledgements preserve interrupted, newer and unrelated drafts", () => {
  const key = shareDraftStorageKey("library:new");
  const values = new Map([[key, "submitted draft"], [`${key}:submitted`, JSON.stringify({ token: "save-1", draft: "submitted draft" })]]);
  const storage = { getItem: (name: string) => values.get(name) ?? null, removeItem: (name: string) => { values.delete(name); } };
  acknowledgeShareDraft(storage, "library:new", "another-save");
  assert.equal(values.get(key), "submitted draft");
  values.set(key, "newer unsaved draft");
  acknowledgeShareDraft(storage, "library:new", "save-1");
  assert.equal(values.get(key), "newer unsaved draft");
  values.set(`${key}:submitted`, JSON.stringify({ token: "save-2", draft: "newer unsaved draft" }));
  acknowledgeShareDraft(storage, "library:new", "save-2");
  assert.equal(values.has(key), false);
  values.set(key, "legacy draft"); values.set(`${key}:submitted`, "true");
  acknowledgeShareDraft(storage, "library:new", "save-2");
  assert.equal(values.get(key), "legacy draft");
});
