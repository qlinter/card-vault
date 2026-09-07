const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { createDesktopLogger } = require("../electron/desktop-logger");

test("logging failure is nonfatal and growth is bounded by rotation", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "card-vault-logger-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const logger = createDesktopLogger(root, { maxBytes: 60 });
  for (let i = 0; i < 10; i++) assert.equal(logger.appendLog("desktop.log", "test log message"), true);
  assert.equal(fs.existsSync(path.join(root, "desktop.log.previous")), true);
  assert.ok(fs.statSync(path.join(root, "desktop.log")).size < 150);
  const blocked = createDesktopLogger(path.join(root, "desktop.log", "impossible"));
  assert.equal(blocked.ensureLogsDir(), false);
  assert.equal(blocked.appendLog("error.log", "startup error"), false);
});
