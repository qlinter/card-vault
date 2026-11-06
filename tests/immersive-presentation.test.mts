import test from "node:test";
import assert from "node:assert/strict";
import { defaultGalleryPreferences, galleryCaption, galleryPosition, galleryScenes, normalizeGalleryPreferences, type GalleryCard } from "../lib/immersive-presentation.ts";

test("gallery preferences recover corrupt or future settings without unsafe CSS values", () => {
  assert.deepEqual(normalizeGalleryPreferences(null), defaultGalleryPreferences);
  assert.deepEqual(normalizeGalleryPreferences({ scene: "future", layout: "broken", artScale: Infinity, light: "url(secret)", captions: null, motion: undefined }), defaultGalleryPreferences);
  const saved = normalizeGalleryPreferences({ scene: "spotlight", layout: "focus", artScale: 73, light: 20, captions: false, motion: false });
  assert.deepEqual(normalizeGalleryPreferences(JSON.parse(JSON.stringify(saved))), saved);
  assert.equal(normalizeGalleryPreferences({ artScale: 10000, light: -10 }).artScale, 100);
  assert.equal(normalizeGalleryPreferences({ artScale: -1, light: -10 }).artScale, 60);
  assert.equal(normalizeGalleryPreferences({ light: -10 }).light, 0);
});
test("exhibition numbering follows the visible history including previous rounds", () => {
  assert.deepEqual(galleryPosition(4, 4), { current: 1, total: 4, round: 2 });
  assert.deepEqual(galleryPosition(3, 4), { current: 4, total: 4, round: 1 });
  assert.deepEqual(galleryPosition(0, 0), { current: 0, total: 0, round: 1 });
});

test("all exhibition scenes round-trip existing appearance settings", () => {
  for (const scene of Object.keys(galleryScenes)) {
    const stored = { ...defaultGalleryPreferences, scene, layout: "focus", light: 35, artScale: 76 };
    assert.deepEqual(normalizeGalleryPreferences(JSON.parse(JSON.stringify(stored))), stored);
  }
});

test("saved exhibition settings accept legacy appearance records and validate playback options", () => {
  const legacy = normalizeGalleryPreferences({ scene: "archive", layout: "focus", motion: false });
  assert.equal(Object.hasOwn(legacy, "motion"), false);
  assert.equal(legacy.scene, "archive"); assert.equal(legacy.interval, 8); assert.equal(legacy.allImages, false); assert.equal(legacy.random, false);
  const saved = normalizeGalleryPreferences({ ...legacy, interval: 17, allImages: true, random: true });
  assert.deepEqual(normalizeGalleryPreferences(JSON.parse(JSON.stringify(saved))), saved);
  assert.equal(normalizeGalleryPreferences({ interval: Infinity, allImages: "true", random: 1 }).interval, 8);
  assert.equal(normalizeGalleryPreferences({ interval: -5 }).interval, 1);
  assert.equal(normalizeGalleryPreferences({ interval: 10000 }).interval, 3600);
});

test("exhibit labels suppress repeated titles and years without hiding different numbers", () => {
  const card: GalleryCard = { id: "a", playerName: "Carter", cardTitle: "2024 Heritage Gold PSA 10", collectionStatus: "holding", year: "2024", parallel: "Gold", gradingCompany: "PSA", grade: "10", images: [] };
  const caption = galleryCaption(card);
  assert.equal(caption.year, undefined); assert.equal(caption.facts.length, 0);
  assert.equal(galleryCaption({ ...card, cardTitle: "Carter" }).subtitle, "");
  const different = galleryCaption({ ...card, cardTitle: "2010 Heritage", gradingCompany: null, parallel: null });
  assert.equal(different.year, "2024"); assert.equal(different.facts.find(fact => fact.label === "评级")?.value, "10");
});
