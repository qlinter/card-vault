import assert from "node:assert/strict";
import test from "node:test";
import {
  createSharePresentation,
  defaultSharePresentation,
  maxShareFeaturedCards,
  parseSharePresentation,
  sanitizeSharePresentationCards,
  serializeSharePresentation,
  toggleFeaturedCardId
} from "../lib/share-presentation.ts";
import { fallbackShareSections, parseShareSectionDrafts } from "../lib/share-sections.ts";
import {
  applyShareGalleryTemplate,
  shareGalleryTemplates
} from "../lib/share-templates.ts";
import { sharePreviewDevices } from "../lib/share-preview-devices.ts";

test("share presentation normalizes layout and bounded visual controls", () => {
  const presentation = createSharePresentation({
    templateId: "arena-lineup",
    layout: "arena",
    backgroundPositionX: "125",
    backgroundPositionY: "-10",
    panelOpacity: "28",
    typography: "editorial",
    density: "compact",
    imageFit: "contain",
    textScale: "large",
    featuredCardIds: JSON.stringify(["card-a", "card-b"])
  });

  assert.equal(presentation.layout, "arena");
  assert.equal(presentation.version, 3);
  assert.equal(presentation.templateId, "arena-lineup");
  assert.deepEqual(presentation.backgroundPosition, { x: 100, y: 0 });
  assert.equal(presentation.panelOpacity, 28);
  assert.equal(presentation.typography, "editorial");
  assert.equal(presentation.density, "compact");
  assert.equal(presentation.imageFit, "contain");
  assert.equal(presentation.textScale, "large");
  assert.deepEqual(presentation.featuredCardIds, ["card-a", "card-b"]);
  assert.deepEqual(parseSharePresentation(serializeSharePresentation(presentation)), presentation);
});

test("invalid presentation data falls back to the stage layout", () => {
  assert.deepEqual(parseSharePresentation("not-json"), defaultSharePresentation);
  assert.equal(parseSharePresentation({ layout: "unknown" }).layout, "stage");
});

test("legacy gallery presentation remains compatible and becomes a custom version 3 presentation", () => {
  const legacy = parseSharePresentation({
    version: 1,
    layout: "archive",
    backgroundPosition: { x: 21, y: 73 },
    panelOpacity: 31,
    typography: "editorial",
    density: "compact",
    imageFit: "contain",
    textScale: "large"
  });

  assert.equal(legacy.version, 3);
  assert.equal(legacy.templateId, "custom");
  assert.equal(legacy.layout, "archive");
  assert.deepEqual(legacy.backgroundPosition, { x: 21, y: 73 });
  assert.equal(legacy.panelOpacity, 31);
  assert.equal(legacy.typography, "editorial");
  assert.equal(legacy.density, "compact");
  assert.equal(legacy.imageFit, "contain");
  assert.equal(legacy.textScale, "large");
});

test("featured cards are unique, bounded, toggleable, and preserved by templates", () => {
  const ids = Array.from({ length: maxShareFeaturedCards + 2 }, (_, index) => `card-${index}`);
  const parsed = parseSharePresentation({ featuredCardIds: [...ids, ids[0]] });
  assert.deepEqual(parsed.featuredCardIds, ids.slice(0, maxShareFeaturedCards));
  assert.deepEqual(toggleFeaturedCardId(["a"], "b", true), ["a", "b"]);
  assert.deepEqual(toggleFeaturedCardId(["a", "b"], "a", false), ["b"]);
  const applied = applyShareGalleryTemplate({ ...defaultSharePresentation, featuredCardIds: ["hero"] }, "archive-journal");
  assert.deepEqual(applied.featuredCardIds, ["hero"]);
});

test("featured cards are restricted to cards that still belong to the gallery", () => {
  const sanitized = sanitizeSharePresentationCards({
    ...defaultSharePresentation,
    featuredCardIds: ["missing", "card-b", "card-a"]
  }, ["card-a", "card-b"]);

  assert.deepEqual(sanitized.featuredCardIds, ["card-b", "card-a"]);
});

test("three production gallery styles apply structural presets without owning the theme", () => {
  assert.deepEqual(shareGalleryTemplates.map((template) => template.id), [
    "collector-spotlight",
    "archive-journal",
    "arena-lineup"
  ]);

  for (const template of shareGalleryTemplates) {
    const applied = applyShareGalleryTemplate(defaultSharePresentation, template.id);
    assert.equal(applied.templateId, template.id);
    assert.equal(applied.layout, template.presentation.layout);
    assert.deepEqual(applied.backgroundPosition, template.presentation.backgroundPosition);
    assert.equal(Object.hasOwn(template, "theme"), false);
  }
});

test("panel opacity is bounded to an intentionally visible editing range", () => {
  assert.equal(parseSharePresentation({ panelOpacity: 0 }).panelOpacity, 10);
  assert.equal(parseSharePresentation({ panelOpacity: 100 }).panelOpacity, 90);
});

test("preview device widths define desktop, tablet, and mobile contracts", () => {
  assert.deepEqual(sharePreviewDevices.map(({ id, width }) => ({ id, width })), [
    { id: "desktop", width: 1440 },
    { id: "tablet", width: 768 },
    { id: "mobile", width: 390 }
  ]);
});

test("share sections keep valid cards and normalize section layouts", () => {
  const sections = parseShareSectionDrafts(
    JSON.stringify([
      { id: "one", title: "精选", description: "说明", layout: "rail", cardIds: ["a", "missing", "a"] },
      { id: "two", title: "档案", layout: "unknown", cardIds: ["b"] }
    ]),
    ["a", "b"]
  );

  assert.deepEqual(sections[0].cardIds, ["a"]);
  assert.equal(sections[0].layout, "rail");
  assert.equal(sections[1].layout, "editorial");
});

test("legacy gallery copy becomes editable section drafts", () => {
  const sections = fallbackShareSections({
    themeNarrative: "生涯叙事",
    themeHighlights: "收藏亮点",
    groupNotes: "分组说明",
    cardIds: ["a", "b"]
  });

  assert.deepEqual(sections.map((section) => section.layout), ["editorial", "rail", "grid"]);
  assert.deepEqual(sections[1].cardIds, ["a", "b"]);
});
