import assert from "node:assert/strict";
import test from "node:test";
import { existsSync } from "node:fs";
import { appThemes, appThemeStyle, normalizeAppTheme } from "../lib/app-themes.ts";

function luminance(hex: string) {
  const channels = hex.slice(1).match(/../g)!.map(value => parseInt(value, 16) / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
  return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
}

test("unknown themes fall back to the unchanged Classic palette", () => {
  for (const input of [undefined, null, "", "removed-theme", "__proto__", {}, "MIDNIGHT"]) assert.equal(normalizeAppTheme(input), "classic");
  assert.deepEqual(appThemeStyle("classic"), {});
});

test("theme registry supplies offline assets and readable text/control pairs", () => {
  assert.equal(new Set(appThemes.map(theme => theme.id)).size, appThemes.length);
  for (const theme of appThemes) {
    assert.ok(existsSync(new URL(`../public${theme.background}`, import.meta.url)), theme.background);
    assert.equal(normalizeAppTheme(theme.id), theme.id);
    if (theme.id === "classic") continue;
    const tokens = theme.tokens;
    for (const [text, background] of [["--ink", "--surface"], ["--slate", "--surface"], ["--muted-ink", "--surface-soft"], ["--theme-on-accent", "--accent"], ["--theme-positive", "--surface"], ["--theme-negative", "--surface"], ["--teal", "--surface"]]) {
      const values = [luminance(tokens[text as keyof typeof tokens]), luminance(tokens[background as keyof typeof tokens])].sort((a, b) => b - a);
      assert.ok((values[0] + .05) / (values[1] + .05) >= 4.5, `${theme.id}: ${text} on ${background}`);
    }
  }
});
