const assert = require("node:assert/strict");
const test = require("node:test");
const { createOperationCoordinator } = require("../electron/operation-coordinator");

test("storage and AI restart share an exclusive operation and release it after failure", async () => {
  const run = createOperationCoordinator();
  let release;
  const backup = run("backup", () => new Promise((resolve) => { release = resolve; }));
  let saved = false;
  await assert.rejects(run("AI settings", async () => { saved = true; }), /backup/);
  assert.equal(saved, false);
  release();
  await backup;
  await assert.rejects(run("restore", async () => { throw new Error("failed"); }), /failed/);
  assert.equal(await run("AI settings", async () => "ready"), "ready");
});
