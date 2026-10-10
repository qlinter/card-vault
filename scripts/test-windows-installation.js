const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync, spawn } = require("node:child_process");
const { DatabaseSync } = require("node:sqlite");
const { checkPackagedDesktop } = require("./test-packaged-desktop-utils");
const { sha256File } = require("../lib/file-hash");
const { createStorageManager } = require("../electron/storage");
const { findAvailablePort, stopServer } = require("./test-http-flow-utils");
const version = require("../package.json").version;
const previousVersion = process.argv.find(argument => argument.startsWith("--previous-version="))?.split("=")[1] || "1.3.5";
assert.match(previousVersion, /^\d+\.\d+\.\d+$/, "Previous version must use x.y.z format.");
const root = path.resolve(__dirname, ".."), workspace = path.join(root, "logs", `v${version}-review`, "windows-acceptance");
const appId = "com.ql.cardvault.acceptance";
const productName = "Card Vault Acceptance";
const installDir = path.join(workspace, "installed");
const userData = path.join(workspace, "profile");
const env = { ...process.env, CARD_VAULT_USER_DATA_DIR: userData, CARD_VAULT_ACCEPTANCE_MODE: "1" };
delete env.ELECTRON_RUN_AS_NODE;

function owned(target) {
  const resolved = path.resolve(target);
  assert.ok(resolved.startsWith(workspace + path.sep), `Acceptance path escapes workspace: ${resolved}`);
  return resolved;
}
function run(executable, args, { logFile, ...options } = {}) {
  const result = spawnSync(executable, args, { cwd: root, env, windowsHide: true, encoding: "utf8", timeout: 180000, ...options });
  if (logFile) fs.writeFileSync(logFile, (result.stdout ?? "") + (result.stderr ?? ""));
  if (result.error) throw result.error;
  assert.equal(result.status, 0, result.stderr?.slice(-2000) || `${path.basename(executable)} failed`);
  return result.stdout;
}
function powershell(code) { return run("powershell.exe", ["-NoProfile", "-Command", "$ErrorActionPreference='Stop'; " + code]); }
function acceptanceInstallationCount() {
  return Number(powershell(String.raw`@(Get-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*' -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName -like '${productName}*' }).Count`).trim());
}
function installerConfig(appDir, version, output) {
  const base = require(path.join(root, "package.json")).build;
  return { ...base, appId, productName, executableName: productName, compression: "store", electronDist: path.join(root, "node_modules", "electron", "dist"),
    extraMetadata: { name: "card-vault-acceptance", productName, version, main: "electron/main.js" },
    directories: { app: appDir, buildResources: path.join(root, "build"), output },
    nsis: { ...base.nsis, differentialPackage: false, artifactName: `card-vault-acceptance-${version}-setup.exe`, perMachine: false, allowElevation: false, createDesktopShortcut: false, createStartMenuShortcut: false, runAfterFinish: false, deleteAppDataOnUninstall: false }
  };
}
function packageInstaller(appDir, version, name) {
  const output = owned(path.join(workspace, name)); fs.mkdirSync(output, { recursive: true });
  const config = owned(path.join(workspace, `${name}.json`));
  fs.writeFileSync(config, JSON.stringify(installerConfig(appDir, version, output), null, 2));
  const unpacked = path.join(output, "win-unpacked"), metadataPath = path.join(unpacked, "resources", "app", "package.json");
  const metadata = fs.existsSync(metadataPath) ? JSON.parse(fs.readFileSync(metadataPath, "utf8")) : null;
  const setup = path.join(output, `card-vault-acceptance-${version}-setup.exe`);
  if (name === "old" && process.argv.includes("--reuse-old-build") && metadata?.version === version && metadata?.name === "card-vault-acceptance" && fs.existsSync(setup)) return { setup, unpacked };
  if (name === "current" && process.argv.includes("--reuse-current-build") && metadata?.version === version && metadata?.name === "card-vault-acceptance" && fs.existsSync(setup)) {
    assert.equal(fs.readFileSync(path.join(unpacked, "resources", "app", ".next", "BUILD_ID"), "utf8"), fs.readFileSync(path.join(root, ".next", "BUILD_ID"), "utf8"), "Current installer contains a different application build.");
    return { setup, unpacked };
  }
  // Historical source is immutable; reuse its verified packaging after an installer-build retry.
  const reuse = name === "old" && metadata?.version === version && metadata?.name === "card-vault-acceptance" && fs.existsSync(path.join(unpacked, `${productName}.exe`));
  run(process.execPath, [path.join(root, "node_modules", "electron-builder", "cli.js"), "--config", config, "--win", "nsis", ...(reuse ? ["--prepackaged", unpacked] : [])], { timeout: 600000, logFile: owned(path.join(workspace, `${name}-build.log`)) });
  return { setup: path.join(output, `card-vault-acceptance-${version}-setup.exe`), unpacked: path.join(output, "win-unpacked") };
}
function dataFacts(dataDir) {
  const db = new DatabaseSync(path.join(dataDir, "dev.db"), { readOnly: true });
  try { return { card: db.prepare("SELECT id,playerName,cardTitle,sport,holdingQuantity FROM Card WHERE id='acceptance'").get(), transaction: db.prepare("SELECT id,kind,amountMinor,currency,quantity,occurredAt FROM CardTransaction WHERE cardId='acceptance'").all(), valuation: db.prepare("SELECT id,amountMinor,currency,source FROM CardValuation WHERE cardId='acceptance'").all(), image: sha256File(path.join(dataDir, "uploads", "acceptance.png")) }; }
  finally { db.close(); }
}
async function checkDesktop(executable, version) {
  await checkPackagedDesktop(executable, version, { env, userData, playerName: "Acceptance Player", query: "Acceptance" });
}
async function checkOldInstalledRuntime(executable, appRoot, dataDir) {
  const port = await findAvailablePort(3430), output = [];
  const server = spawn(executable, [path.join(appRoot, "node_modules", "next", "dist", "bin", "next"), "start", "--hostname", "127.0.0.1", "--port", String(port)], { cwd: appRoot, env: { ...env, ELECTRON_RUN_AS_NODE: "1", CARD_VAULT_DATA_DIR: dataDir, DATABASE_URL: `file:${path.join(dataDir, "dev.db").replaceAll("\\", "/")}` }, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
  server.stdout.on("data", chunk => output.push(String(chunk))); server.stderr.on("data", chunk => output.push(String(chunk)));
  try {
    let ready = false;
    for (let attempt = 0; attempt < 120; attempt++) {
      try { const response = await fetch(`http://127.0.0.1:${port}/`); if (response.ok) { assert.match(await response.text(), /Acceptance Player/); ready = true; break; } } catch { /* Startup. */ }
      await new Promise(resolve => setTimeout(resolve, 250));
    }
    assert.ok(ready, "Installed historical runtime did not load the isolated collection.");
  } finally { stopServer(server); }
}
async function main() {
  assert.equal(process.platform, "win32"); fs.mkdirSync(workspace, { recursive: true });
  assert.equal(acceptanceInstallationCount(), 0, "An acceptance installation already exists; inspect it before running again.");
  const installedMetadataPath = path.join(installDir, "resources", "app", "package.json");
  const ownedRemnant = process.argv.includes("--reuse-old-build") && fs.existsSync(installedMetadataPath) && JSON.parse(fs.readFileSync(installedMetadataPath, "utf8")).name === "card-vault-acceptance";
  assert.ok(!fs.existsSync(path.join(installDir, `${productName}.exe`)) || ownedRemnant, "Acceptance installation directory is already in use.");
  assert.equal(powershell(`@(Get-Process -Name '${productName}' -ErrorAction SilentlyContinue).Count`).trim(), "0", "An acceptance process is still running.");
  for (const folder of [installDir, userData, path.join(workspace, "portable-relocated"), path.join(workspace, "migrated-data")]) {
    if (!fs.existsSync(folder)) continue;
    const resolved = fs.realpathSync(owned(folder)); owned(resolved);
    const database = path.join(resolved, folder === userData ? "data" : "", "dev.db");
    if (fs.existsSync(database)) {
      const existingDb = new DatabaseSync(database, { readOnly: true });
      try { assert.equal(existingDb.prepare("SELECT COUNT(*) n FROM Card WHERE id<>'acceptance'").get().n, 0, "Unexpected collection in acceptance directory."); } finally { existingDb.close(); }
    }
    fs.rmSync(resolved, { recursive: true, force: true });
  }
  const oldRoot = owned(path.join(workspace, "historical"));
  if (!fs.existsSync(path.join(oldRoot, "resources", "app", "package.json"))) {
    const filename = `card-vault-${previousVersion}-portable.zip`;
    const archive = [path.join(root, "dist", filename), path.join(root, "backups", "releases", `v${previousVersion}`, filename)].find(candidate => fs.existsSync(candidate));
    assert.ok(archive, `Historical portable package is missing for v${previousVersion}.`);
    powershell(`Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::ExtractToDirectory('${archive.replaceAll("'", "''")}','${oldRoot.replaceAll("'", "''")}')`);
  }
  assert.equal(JSON.parse(fs.readFileSync(path.join(oldRoot, "resources", "app", "package.json"), "utf8")).version, previousVersion);
  const old = packageInstaller(path.join(oldRoot, "resources", "app"), previousVersion, "old");
  const current = packageInstaller(root, version, "current");
  const executable = path.join(installDir, `${productName}.exe`);
  let installed = false;
  const checks = [];
  const saveChecks = () => fs.writeFileSync(owned(path.join(workspace, "report.json")), JSON.stringify({ testedAt: new Date().toISOString(), identity: appId, isolation: "Separate NSIS identity, no shortcuts, dedicated user data and fixtures", checks }, null, 2));
  try {
    run(old.setup, ["/S", "/currentuser", `/D=${owned(installDir)}`], { timeout: 600000 }); installed = true;
    assert.ok(fs.existsSync(executable));
    const appRoot = path.join(installDir, "resources", "app"), dataDir = owned(path.join(userData, "data"));
    run(executable, [path.join(appRoot, "scripts", "init-db.js")], { cwd: appRoot, env: { ...env, ELECTRON_RUN_AS_NODE: "1", CARD_VAULT_DATA_DIR: dataDir } });
    fs.mkdirSync(path.join(dataDir, "uploads"), { recursive: true });
    const sharp = require("sharp");
    await sharp({ create: { width: 800, height: 1200, channels: 3, background: "#123456" } }).png().toFile(path.join(dataDir, "uploads", "acceptance.png"));
    const db = new DatabaseSync(path.join(dataDir, "dev.db"));
    db.exec("INSERT INTO Card(id,playerName,cardTitle,sport,holdingQuantity) VALUES('acceptance','Acceptance Player','Upgrade fixture','Basketball',1); INSERT INTO CardImage(id,cardId,path) VALUES('image','acceptance','/media/acceptance.png'); INSERT INTO CardTransaction(id,cardId,kind,amountMinor,currency,quantity,occurredAt,provenance) VALUES('buy','acceptance','purchase',12345,'CNY',1,'2026-01-01T00:00:00.000Z','acceptance'); INSERT INTO CardValuation(id,cardId,amountMinor,currency,valuedAt,source,provenance) VALUES('quote','acceptance',15000,'CNY','2026-10-01T00:00:00.000Z','个人估计','acceptance')"); db.close();
    const before = dataFacts(dataDir);
    await checkOldInstalledRuntime(executable, appRoot, dataDir); checks.push({ name: "fresh-install", version: previousVersion, ok: true }); saveChecks(); process.stdout.write("Fresh installation passed.\n");
    run(current.setup, ["/S", "/currentuser", `/D=${owned(installDir)}`], { timeout: 600000 });
    assert.equal(JSON.parse(fs.readFileSync(path.join(appRoot, "package.json"))).version, version);
    await checkDesktop(executable, version); assert.deepEqual(dataFacts(dataDir), before);
    checks.push({ name: "in-place-upgrade-and-data-retention", from: previousVersion, to: version, ok: true });
    saveChecks(); process.stdout.write("Upgrade, data retention and desktop Back navigation passed.\n");
    const portable = owned(path.join(workspace, "portable-relocated"));
    assert.ok(!fs.existsSync(portable), "Portable acceptance directory already exists.");
    fs.cpSync(current.unpacked, portable, { recursive: true });
    const storage = createStorageManager({ appDataRoot: userData, projectRoot: path.join(portable, "resources", "app") });
    const migrated = owned(path.join(workspace, "migrated-data")); storage.migrateTo(migrated);
    await checkDesktop(path.join(portable, `${productName}.exe`), version); assert.deepEqual(dataFacts(migrated), before);
    checks.push({ name: "portable-relocation-and-storage-migration", ok: true });
    saveChecks();
    process.stdout.write(JSON.stringify(checks) + "\n");
  } finally {
    if (installed) {
      const uninstall = owned(path.join(installDir, `Uninstall ${productName}.exe`));
      if (fs.existsSync(uninstall)) run(uninstall, ["/S", "/currentuser"], { timeout: 120000 });
      // NSIS can return after relaunching a temporary uninstaller process.
      const deadline = Date.now() + 120000;
      while ((fs.existsSync(executable) || acceptanceInstallationCount() > 0) && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 500));
      assert.ok(!fs.existsSync(executable), "Acceptance executable remains after uninstall.");
      assert.equal(acceptanceInstallationCount(), 0, "Acceptance uninstall registration remains.");
      checks.push({ name: "isolated-uninstall", ok: true }); saveChecks();
      process.stdout.write("Isolated acceptance uninstall verified.\n");
    }
  }
}
main().catch(error => { process.stderr.write(error.stack + "\n"); process.exitCode = 1; });
