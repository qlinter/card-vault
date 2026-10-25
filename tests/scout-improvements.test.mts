import test from "node:test";
import assert from "node:assert/strict";
import { matchesSearch, searchTerms } from "../lib/search-terms.ts";
test("wish search matches words across title, subject and notes without losing Chinese or punctuation", () => {
  assert.deepEqual(searchTerms("  Jordan  GOLD Jordan\n2025 "), ["jordan", "gold", "2025"]);
  assert.ok(matchesSearch("Jordan · 2025 · 金签 #12 · PSA 10", "PSA Jordan #12 金签"));
  assert.equal(matchesSearch("Jordan · 2025 · Gold", "Jordan 2024"), false);
  assert.ok(matchesSearch("anything", ""));
});
