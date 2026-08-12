import assert from "node:assert/strict";
import test from "node:test";
import {
  createSharePresentation,
  defaultSharePresentation,
  parseSharePresentation,
  serializeSharePresentation
} from "../lib/share-presentation.ts";
import { fallbackShareSections, parseShareSectionDrafts } from "../lib/share-sections.ts";

test("share presentation normalizes layout and bounded visual controls", () => {
  const presentation = createSharePresentation({
    layout: "arena",
    backgroundPositionX: "125",
    backgroundPositionY: "-10",
    panelOpacity: "28",
    typography: "editorial",
    density: "compact",
    imageFit: "contain",
    textScale: "large"
  });

  assert.equal(presentation.layout, "arena");
  assert.deepEqual(presentation.backgroundPosition, { x: 100, y: 0 });
  assert.equal(presentation.panelOpacity, 28);
  assert.equal(presentation.typography, "editorial");
  assert.equal(presentation.density, "compact");
  assert.equal(presentation.imageFit, "contain");
  assert.equal(presentation.textScale, "large");
  assert.deepEqual(parseSharePresentation(serializeSharePresentation(presentation)), presentation);
});

test("invalid presentation data falls back to the stage layout", () => {
  assert.deepEqual(parseSharePresentation("not-json"), defaultSharePresentation);
  assert.equal(parseSharePresentation({ layout: "unknown" }).layout, "stage");
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
