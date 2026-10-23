const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawn, spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");

async function checkLaunch(userData, rebuild) {
  const logPath = path.join(userData, "logs", "desktop.log");
  const offset = fs.existsSync(logPath) ? fs.readFileSync(logPath, "utf8").length : 0;
  const env = { ...process.env, CARD_VAULT_USER_DATA_DIR: userData, CARD_VAULT_ACCEPTANCE_MODE: "1" };
  delete env.ELECTRON_RUN_AS_NODE;
  const child = spawn("cmd.exe", ["/d", "/c", "start-desktop.bat"], { cwd: root, env, windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
  let failure;
  child.on("error", error => { failure = error; });
  child.stdin.on("error", () => { /* A failed launcher may already have closed stdin. */ });
  child.stdin.end("\n");
  for (const stream of [child.stdout, child.stderr]) stream.on("data", chunk => process.stdout.write(chunk));
  try {
    const startedAt = Date.now();
    let nextProgress = startedAt + 15000;
    while (Date.now() - startedAt < 300000) {
      if (failure) throw failure;
      const log = fs.existsSync(logPath) ? fs.readFileSync(logPath, "utf8").slice(offset) : "";
      assert.ok(!log.includes("Startup failed:"), log);
      if (log.includes("Desktop app boot completed.")) {
        assert.ok(log.includes(rebuild ? "Build missing or stale; preparing local app build." : "Existing build found."), log);
        console.log(`Desktop launcher passed: ${rebuild ? "automatic build" : "existing build"} (${Math.round((Date.now() - startedAt) / 1000)}s).`);
        return;
      }
      assert.equal(child.exitCode, null, `Launcher exited with code ${child.exitCode}.\n${log}`);
      if (Date.now() >= nextProgress) {
        console.log(`Waiting for desktop ${rebuild ? "build and startup" : "startup"}; logs: ${path.dirname(logPath)}`);
        nextProgress = Date.now() + 15000;
      }
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    throw new Error(`Desktop launcher timed out. See ${logPath} and prepare.log.`);
  } finally {
    // Stop only the process tree created by this test, including its local server.
    if (child.pid && child.exitCode === null) {
      const result = spawnSync("taskkill.exe", ["/pid", String(child.pid), "/t", "/f"], { windowsHide: true, encoding: "utf8", timeout: 10000 });
      assert.equal(result.status, 0, result.stdout + result.stderr);
      await new Promise(resolve => { if (child.exitCode !== null) resolve(); else child.once("close", resolve); });
    }
  }
}

async function main() {
  assert.equal(process.platform, "win32", "The desktop batch launcher test requires Windows.");
  const logDir = path.join(root, "logs", "development-launcher-review");
  fs.mkdirSync(logDir, { recursive: true });
  const userData = fs.mkdtempSync(path.join(logDir, "profile-"));
  // Exercise automatic preparation instead of masking it with a separate build.
  const buildId = path.join(root, ".next", "BUILD_ID");
  if (fs.existsSync(buildId)) fs.utimesSync(buildId, new Date(), new Date(0));
  await checkLaunch(userData, true);
  await checkLaunch(userData, false);
  const result = { testedAt: new Date().toISOString(), userData, checks: ["start-desktop-automatic-build", "start-desktop-existing-build"], ok: true };
  fs.writeFileSync(path.join(logDir, "launcher.json"), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
}

main().catch(error => { console.error(error); process.exitCode = 1; });
