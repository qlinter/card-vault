const test = require("node:test");
const assert = require("node:assert/strict");
const { shouldUseSoftwareRendering } = require("../electron/rendering-mode");

test("hardware acceleration is enabled by default", () => {
  assert.equal(shouldUseSoftwareRendering({ env: {}, argv: ["electron"] }), false);
});

test("software rendering can be enabled through the compatibility environment setting", () => {
  for (const value of ["1", "true", "YES", "on"]) {
    assert.equal(shouldUseSoftwareRendering({ env: { CARD_VAULT_DISABLE_GPU: value }, argv: ["electron"] }), true);
  }
});

test("software rendering can be enabled through a command-line switch", () => {
  assert.equal(shouldUseSoftwareRendering({ env: {}, argv: ["electron", "--disable-gpu"] }), true);
  assert.equal(shouldUseSoftwareRendering({ env: {}, argv: ["electron", "--software-rendering"] }), true);
});
