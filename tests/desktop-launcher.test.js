const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");
const { writeDependencyFingerprint } = require("../scripts/dependency-fingerprint");

function fixture(context, installed = true) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "card vault launcher "));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, "scripts"));
  fs.mkdirSync(path.join(root, "bin"));
  for (const file of ["start-desktop.bat", "scripts/dependency-fingerprint.js"]) {
    fs.copyFileSync(path.join(__dirname, "..", file), path.join(root, file));
  }
  fs.writeFileSync(path.join(root, "package.json"), JSON.stringify({ name: "launcher-fixture", dependencies: { electron: "42.11.9" } }));
  fs.writeFileSync(path.join(root, "package-lock.json"), JSON.stringify({ lockfileVersion: 3, packages: { "node_modules/electron": { version: "42.11.9" } } }));
  fs.writeFileSync(path.join(root, "scripts", "fixture-install.js"), `
    const fs = require('node:fs');
    fs.appendFileSync('events.log', 'dependencies\\n');
    fs.mkdirSync('node_modules/electron', { recursive: true });
    fs.writeFileSync('node_modules/.package-lock.json', '{}');
    fs.copyFileSync('scripts/fixture-runtime.js', 'node_modules/electron/install.js');
  `);
  fs.writeFileSync(path.join(root, "scripts", "fixture-runtime.js"), `
    const fs = require('node:fs');
    fs.appendFileSync('events.log', 'runtime:' + process.env.ELECTRON_MIRROR + '\\n');
    if (process.env.FIXTURE_DOWNLOAD_FAILURE === '1') process.exit(1);
    fs.mkdirSync('node_modules/electron/dist', { recursive: true });
    fs.writeFileSync('node_modules/electron/dist/electron.exe', 'fixture');
  `);
  fs.writeFileSync(path.join(root, "scripts", "fixture-launch.js"), `
    require('node:assert/strict').ok(require('node:fs').existsSync('node_modules/electron/dist/electron.exe'));
    require('node:fs').appendFileSync('events.log', 'launch\\n');
  `);
  fs.writeFileSync(path.join(root, "bin", "npm.cmd"), `@echo off
if "%1"=="config" (echo https://registry.npmmirror.com/& exit /b 0)
if "%1"=="ls" exit /b 0
if "%1"=="ci" (node scripts\\fixture-install.js& exit /b)
if "%1"=="run" (node scripts\\fixture-launch.js& exit /b)
exit /b 9
`);
  if (installed) {
    const result = spawnSync(process.execPath, ["scripts/fixture-install.js"], { cwd: root });
    assert.equal(result.status, 0);
    writeDependencyFingerprint(root);
    fs.writeFileSync(path.join(root, "node_modules", "keep-installed.txt"), "preserved");
    fs.writeFileSync(path.join(root, "events.log"), "");
  }
  return {
    root,
    run(extraEnv = {}) {
      const env = { ...process.env };
      for (const key of Object.keys(env)) {
        if (["path", "electron_mirror", "electron_config_cache"].includes(key.toLowerCase())) delete env[key];
      }
      env.Path = `${path.join(root, "bin")};${process.env.Path || process.env.PATH}`;
      env.NoDefaultCurrentDirectoryInExePath = "1";
      Object.assign(env, extraEnv);
      return spawnSync("cmd.exe", ["/d", "/c", ".\\start-desktop.bat"], { cwd: root, env, input: "\n", encoding: "utf8", windowsHide: true, timeout: 30000 });
    },
    events: () => fs.readFileSync(path.join(root, "events.log"), "utf8").trim().split("\n")
  };
}

test("desktop launcher prepares a lazy Electron runtime without reinstalling valid dependencies", { skip: process.platform !== "win32" }, context => {
  const f = fixture(context);
  const result = f.run();
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.deepEqual(f.events(), ["runtime:https://npmmirror.com/mirrors/electron/", "launch"]);
  assert.equal(fs.readFileSync(path.join(f.root, "node_modules", "keep-installed.txt"), "utf8"), "preserved");
});

test("desktop launcher prepares the runtime after a clean install and preserves a custom mirror", { skip: process.platform !== "win32" }, context => {
  const f = fixture(context, false);
  const result = f.run({ ELECTRON_MIRROR: "https://mirror.example/electron/" });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.deepEqual(f.events(), ["dependencies", "runtime:https://mirror.example/electron/", "launch"]);
  assert.ok(fs.existsSync(path.join(f.root, "node_modules", ".card-vault-dependencies.sha256")));
});

test("a failed Electron download stops launch and can be retried without reinstalling packages", { skip: process.platform !== "win32" }, context => {
  const f = fixture(context);
  const failed = f.run({ FIXTURE_DOWNLOAD_FAILURE: "1" });
  assert.equal(failed.status, 1, failed.stdout + failed.stderr);
  assert.match(failed.stdout, /Electron runtime download failed/);
  assert.deepEqual(f.events(), ["runtime:https://npmmirror.com/mirrors/electron/"]);
  const retried = f.run();
  assert.equal(retried.status, 0, retried.stdout + retried.stderr);
  assert.deepEqual(f.events(), ["runtime:https://npmmirror.com/mirrors/electron/", "runtime:https://npmmirror.com/mirrors/electron/", "launch"]);
});
