const assert = require("node:assert/strict");
const test = require("node:test");
const { isSameOriginUrl, normalizeExternalHttpUrl } = require("../electron/navigation");

test("electron navigation accepts only external HTTP URLs", () => {
  assert.equal(normalizeExternalHttpUrl("https://example.com/cert?id=1"), "https://example.com/cert?id=1");
  assert.equal(normalizeExternalHttpUrl("http://example.com"), "http://example.com/");
  assert.equal(normalizeExternalHttpUrl("javascript:alert(1)"), null);
  assert.equal(normalizeExternalHttpUrl("file:///C:/secret.txt"), null);
  assert.equal(normalizeExternalHttpUrl("not a URL"), null);
});

test("electron navigation recognizes only the local application origin", () => {
  const baseUrl = "http://127.0.0.1:3210";
  assert.equal(isSameOriginUrl("http://127.0.0.1:3210/cards/1", baseUrl), true);
  assert.equal(isSameOriginUrl("http://127.0.0.1:3211/cards/1", baseUrl), false);
  assert.equal(isSameOriginUrl("https://example.com", baseUrl), false);
});
