const assert = require("node:assert/strict"), test = require("node:test"), path = require("node:path"), { execFileSync } = require("node:child_process");
test("UI clock exposes Date statics for framework wrappers and stays fixture-only", () => {
  const clock = path.resolve("scripts/ui-test-clock.js");
  const env = { ...process.env, UI_TEST_MODE: "1", CARD_VAULT_DATA_DIR: path.resolve("tests/.ui-test-runtime/data") };
  const result = execFileSync(process.execPath, ["--require", clock, "-e", "console.log(JSON.stringify({now:Date.now(),iso:new Date().toISOString(),parse:Object.hasOwn(Date,'parse'),utc:Object.hasOwn(Date,'UTC'),valid:Date.UTC(2026,0,1)===Date.parse('2026-01-01')}))"], { env, encoding: "utf8", windowsHide: true });
  const data = JSON.parse(result);
  assert.equal(data.iso, "2026-09-07T04:00:00.000Z"); assert.equal(data.parse, true); assert.equal(data.utc, true); assert.equal(data.valid, true);
  assert.throws(() => execFileSync(process.execPath, ["--require", clock, "-e", ""], { env: { ...env, UI_TEST_MODE: "0" }, stdio: "pipe", windowsHide: true }), /fixed UI clock is restricted/);
});
