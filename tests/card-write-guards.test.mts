import assert from "node:assert/strict";
import test from "node:test";
import { cardIdForSubmission, cardEditVersions, assertCardEditVersion, cardEditConflictMessage } from "../lib/card-write-guards.ts";
import { buildCardData } from "../lib/card-entry-domain.ts";
import { emptyCardFormValues } from "../lib/card-form-values.ts";

function archive() {
  return { ...buildCardData({ ...emptyCardFormValues, playerName: "Player", cardTitle: "Card", sport: "Basketball" }), id: "card", holdingQuantity: 1, createdAt: new Date(0), updatedAt: new Date(0), images: [{ id: "image", cardId: "card", path: "/media/one.png", rotation: 0, createdAt: new Date(0) }] };
}

test("retries retain their identity across pages and scopes while deliberate new entries stay distinct", () => {
  assert.equal(cardIdForSubmission("page-a", "draft"), cardIdForSubmission("page-b", "draft"));
  assert.equal(cardIdForSubmission("page-a", "draft-a", "queue"), cardIdForSubmission("page-b", "draft-b", "queue"));
  assert.equal(cardIdForSubmission("page-a"), cardIdForSubmission("page-a"));
  assert.notEqual(cardIdForSubmission("page-a"), cardIdForSubmission("page-b"));
  assert.notEqual(cardIdForSubmission("same"), cardIdForSubmission("page", "same"));
  assert.notEqual(cardIdForSubmission("page", "same"), cardIdForSubmission("page", undefined, "same"));
  assert.throws(() => cardIdForSubmission(""), /提交标识/);
});

test("archive checks detect changed details, images and status without invalidating independent financial writes", () => {
  const original = archive(), before = cardEditVersions(original);
  assert.doesNotThrow(() => assertCardEditVersion({ ...original, updatedAt: new Date(1000), holdingQuantity: 2 }, before.version));
  for (const changed of [
    { ...original, cardTitle: "New title" },
    { ...original, collectionStatus: "sold" },
    { ...original, images: [{ ...original.images[0], rotation: 90 }] },
    { ...original, images: [] }
  ]) assert.throws(() => assertCardEditVersion(changed, before.version), { message: cardEditConflictMessage });
  assert.equal(cardEditVersions({ ...original, collectionStatus: "sold" }).archiveVersion, before.archiveVersion);
  assert.notEqual(cardEditVersions({ ...original, notes: "New notes" }).archiveVersion, before.archiveVersion);
});
