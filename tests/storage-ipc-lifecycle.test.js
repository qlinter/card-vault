const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const {
  resumeLocalServerWithRetry,
  runWithPausedLocalServer
} = require("../electron/local-server-lifecycle");

function runtimeStub(events, resume = async () => events.push("resume")) {
  return {
    stopServer() { events.push("stop"); return { id: events.length }; },
    async waitForProcessExit() { events.push("wait-exit"); },
    async waitForAvailablePort(port) { events.push(`wait-port:${port}`); },
    getServerPort() { return 3000; },
    resumeLocalServer: resume
  };
}

test("in-place restore pauses the service, runs the replacement, and reconnects", async () => {
  const events = [];
  const runtime = runtimeStub(events);
  const result = await runWithPausedLocalServer(
    runtime,
    async () => { events.push("restore"); return { restoredFrom: "backup" }; },
    {
      beforeResume: () => events.push("before-resume"),
      afterResume: () => events.push("after-resume")
    }
  );

  assert.equal(result.restoredFrom, "backup");
  assert.deepEqual(events, [
    "stop", "wait-exit", "wait-port:3000", "restore",
    "before-resume", "resume", "after-resume"
  ]);
});

test("failed restore reconnects the original service and preserves the task error", async () => {
  const events = [];
  const runtime = runtimeStub(events);
  const restoreError = new Error("restore failed");

  await assert.rejects(
    runWithPausedLocalServer(
      runtime,
      async () => { events.push("restore"); throw restoreError; },
      {
        beforeRecovery: () => events.push("before-recovery"),
        afterRecovery: () => events.push("after-recovery")
      }
    ),
    (error) => error === restoreError
  );
  assert.deepEqual(events, [
    "stop", "wait-exit", "wait-port:3000", "restore",
    "before-recovery", "resume", "after-recovery"
  ]);
});

test("local service reconnection retries after cleaning up a partial start", async () => {
  const events = [];
  let attempts = 0;
  const runtime = runtimeStub(events, async () => {
    attempts += 1;
    events.push(`resume:${attempts}`);
    if (attempts === 1) throw new Error("first start failed");
  });

  await resumeLocalServerWithRetry(runtime);
  assert.deepEqual(events, [
    "resume:1", "stop", "wait-exit", "wait-port:3000", "resume:2"
  ]);
});

test("backup restore IPC never relaunches or quits Electron", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "electron", "ipc", "storage-ipc.js"), "utf8");
  const restoreHandler = source.slice(source.indexOf('trustedHandle("card-vault:restore-data-folder"'));
  assert.doesNotMatch(restoreHandler, /app\.(?:relaunch|quit)\s*\(/);
  assert.match(restoreHandler, /runWithPausedLocalServer/);
});

test("manual backup IPC runs its worker only while the local service is paused", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "electron", "ipc", "storage-ipc.js"), "utf8");
  const handler = source.slice(source.indexOf('trustedHandle("card-vault:backup-data-folder"'), source.indexOf('trustedHandle("card-vault:inspect-data-folder"'));
  assert.match(handler, /runWithPausedLocalServer\(runtime, \(\) => runStorageWorker\(sender, "backup"/);
});

test("progress notification errors cannot block service reconnection", async () => {
  const events = [];
  const runtime = runtimeStub(events);
  await runWithPausedLocalServer(
    runtime,
    async () => { events.push("restore"); return {}; },
    { beforeResume: () => { throw new Error("sender was destroyed"); } }
  );
  assert.equal(events.includes("resume"), true);
});
