import assert from "node:assert/strict";
import test from "node:test";
import { normalizeHttpUrl } from "../lib/http-url.ts";

test("HTTP URL normalization accepts web links and rejects unsafe schemes", () => {
  assert.equal(normalizeHttpUrl(" https://www.psacard.com/cert/123 "), "https://www.psacard.com/cert/123");
  assert.equal(normalizeHttpUrl("http://example.com"), "http://example.com/");
  assert.equal(normalizeHttpUrl("javascript:alert(1)"), null);
  assert.equal(normalizeHttpUrl("file:///C:/secret.txt"), null);
  assert.equal(normalizeHttpUrl("not a url"), null);
});
