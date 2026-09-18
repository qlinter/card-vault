import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCardData,
  cardEntryDraftTitle,
  hasCardEntryDraftContent,
  normalizeCardEntryId,
  normalizeCardFormValues,
  parseCardEntryDraftValues,
  readCardEntrySaveIntent,
  serializeCardEntryDraftValues
} from "../lib/card-entry-domain.ts";
import { emptyCardFormValues } from "../lib/card-form-values.ts";

test("draft values keep only known bounded fields and stable defaults", () => {
  const values = normalizeCardFormValues({
    playerName: "Test Player",
    notes: "x".repeat(10_100),
    isRookie: true,
    visibility: "",
    unknown: "must not persist"
  });

  assert.equal(values.playerName, "Test Player");
  assert.equal(values.notes.length, 10_000);
  assert.equal(values.isRookie, true);
  assert.equal(values.visibility, "private");
  assert.equal((values as unknown as Record<string, unknown>).unknown, undefined);
  assert.deepEqual(parseCardEntryDraftValues(serializeCardEntryDraftValues(values)), values);
  assert.deepEqual(parseCardEntryDraftValues("not-json"), emptyCardFormValues);
});

test("draft content and title reflect meaningful entry fields", () => {
  assert.equal(hasCardEntryDraftContent({ ...emptyCardFormValues }), false);
  assert.equal(
    hasCardEntryDraftContent({ ...emptyCardFormValues, playerName: "Player" }),
    true
  );
  assert.equal(
    cardEntryDraftTitle({
      ...emptyCardFormValues,
      playerName: "Player",
      cardTitle: "Card",
      year: "2026",
      productLine: "Product"
    }),
    "Player · Card · 2026"
  );
});

test("entry intent is allowlisted and domain validation remains centralized", () => {
  assert.equal(normalizeCardEntryId(" valid-id_1 "), "valid-id_1");
  assert.equal(normalizeCardEntryId("../invalid"), undefined);
  const formData = new FormData();
  formData.set("saveIntent", "copy");
  assert.equal(readCardEntrySaveIntent(formData), "view");
  formData.set("saveIntent", "continue");
  assert.equal(readCardEntrySaveIntent(formData), "continue");
  formData.set("saveIntent", "unexpected");
  assert.equal(readCardEntrySaveIntent(formData), "view");

  const card = buildCardData({
    ...emptyCardFormValues,
    playerName: "Player",
    cardTitle: "Card",
    sport: "Basketball",
    serialRange: "/99"
  });
  assert.equal(card.isSerialNumbered, true);
  for (const [autoType, patchType, expected] of [["on-card", "logo patch", true], ["  ", "  ", false]] as const) {
    const typedCard = buildCardData({ ...emptyCardFormValues, playerName: "Player", cardTitle: "Card", sport: "Basketball", autoType, patchType });
    assert.equal(typedCard.isAutograph, expected);
    assert.equal(typedCard.isPatch, expected);
  }
  const manuallyChecked = buildCardData({ ...emptyCardFormValues, playerName: "Player", cardTitle: "Card", sport: "Basketball", isAutograph: true, isPatch: true });
  assert.equal(manuallyChecked.isAutograph, true);
  assert.equal(manuallyChecked.isPatch, true);
  assert.throws(
    () => buildCardData({ ...emptyCardFormValues, cardTitle: "Card", sport: "Basketball" }),
    /卡片主体/
  );
});
