const assert = require("node:assert/strict");
const test = require("node:test");
const { createSecureWebPreferences } = require("../electron/window-options");

test("desktop renderer uses isolation and the Electron sandbox", () => {
  assert.deepEqual(createSecureWebPreferences("C:/app/preload.js"), {
    preload: "C:/app/preload.js",
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true,
    webSecurity: true,
    allowRunningInsecureContent: false
  });
});
