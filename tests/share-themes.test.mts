import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { normalizeShareTheme, shareThemeBackgroundPath, shareThemeCssVariables, shareThemes } from "../lib/share-themes.ts";

const publicDirectory = fileURLToPath(new URL("../public/", import.meta.url));

test("share themes expose general and sport gallery directions", () => {
  assert.deepEqual(
    shareThemes.map((theme) => theme.id),
    ["spotlight", "archive", "football", "basketball", "tennis", "f1", "nerazzurri", "nerazzurri-2"]
  );
});

test("unknown share themes fall back to spotlight", () => {
  assert.equal(normalizeShareTheme("archive"), "archive");
  assert.equal(normalizeShareTheme("football"), "football");
  assert.equal(normalizeShareTheme("f1"), "f1");
  assert.equal(normalizeShareTheme("nerazzurri"), "nerazzurri");
  assert.equal(normalizeShareTheme("nerazzurri-2"), "nerazzurri-2");
  assert.equal(normalizeShareTheme("unknown"), "spotlight");
  assert.equal(normalizeShareTheme(null), "spotlight");
});

test("theme background paths are exposed for built-in visual themes", () => {
  assert.equal(shareThemeBackgroundPath("spotlight"), "/share-themes/spotlight-gallery.webp");
  assert.equal(shareThemeBackgroundPath("archive"), "/share-themes/archive-gallery.webp");
  assert.equal(shareThemeBackgroundPath("football"), "/share-themes/football-pitch.webp");
  assert.equal(shareThemeBackgroundPath("basketball"), "/share-themes/basketball-home-court.webp");
  assert.equal(shareThemeBackgroundPath("tennis"), "/share-themes/tennis-center.webp");
  assert.equal(shareThemeBackgroundPath("f1"), "/share-themes/f1-pit-lane.webp");
  assert.equal(shareThemeBackgroundPath("nerazzurri"), "/share-themes/nerazzurri-1.webp");
  assert.equal(shareThemeBackgroundPath("nerazzurri-2"), "/share-themes/nerazzurri-2.webp");
});

test("every built-in share theme has a packaged background asset", () => {
  for (const theme of shareThemes) {
    const assetPath = fileURLToPath(new URL(`.${theme.backgroundImagePath}`, new URL("../public/", import.meta.url)));
    assert.ok(assetPath.startsWith(publicDirectory));
    assert.ok(existsSync(assetPath), `${theme.id} background asset is missing`);
  }
});

test("themes expose shared gallery design tokens", () => {
  const variables = shareThemeCssVariables("archive");
  assert.equal(variables["--gallery-text"], "#1b2d49");
  assert.equal(variables["--gallery-accent"], "#a36f24");
  assert.ok(variables["--gallery-panel-rgb"]);
});
