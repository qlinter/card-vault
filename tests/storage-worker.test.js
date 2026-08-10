const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { DatabaseSync } = require("node:sqlite");

const projectRoot = path.resolve(__dirname, "..");
const workerPath = path.join(projectRoot, "electron", "storage-worker.js");

function runWorker(request) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [workerPath], {
      cwd: projectRoot,
      stdio: ["ignore", "ignore", "pipe", "ipc"]
    });
    const progress = [];
    let resultMessage = null;
    let errorMessage = "";

    child.stderr.on("data", (chunk) => {
      errorMessage += chunk.toString();
    });
    child.on("message", (message) => {
      if (message?.type === "progress") progress.push(message.progress);
      if (message?.type === "result") resultMessage = message;
      if (message?.type === "error") errorMessage = message.error?.message || errorMessage;
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code !== 0 || !resultMessage) {
        reject(new Error(errorMessage || `Storage worker exited with code ${code}.`));
        return;
      }
      resolve({ ...resultMessage, progress });
    });
    child.send(request);
  });
}

test("storage worker performs health checks, backups, restores, and migrations outside the caller process", async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "card-vault-storage-worker-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const appDataRoot = path.join(root, "app-data");
  const dataDir = path.join(root, "data");
  const backupDir = path.join(root, "backups");
  fs.mkdirSync(path.join(dataDir, "uploads"), { recursive: true });
  fs.mkdirSync(appDataRoot, { recursive: true });
  fs.writeFileSync(path.join(dataDir, "uploads", "card.jpg"), "card");
  fs.writeFileSync(
    path.join(appDataRoot, "storage-config.json"),
    JSON.stringify({ dataDir, backupDir })
  );

  const db = new DatabaseSync(path.join(dataDir, "dev.db"));
  db.exec(`
    CREATE TABLE Card (id TEXT PRIMARY KEY);
    CREATE TABLE CardImage (id TEXT PRIMARY KEY, path TEXT NOT NULL);
    CREATE TABLE ShareCollection (id TEXT PRIMARY KEY, coverImagePath TEXT, backgroundImagePath TEXT);
    INSERT INTO Card (id) VALUES ('card-1');
    INSERT INTO CardImage (id, path) VALUES ('image-1', '/media/card.jpg');
  `);
  db.close();

  const config = { appDataRoot, projectRoot };
  const health = await runWorker({ operation: "health", payload: {}, config });
  assert.notEqual(health.workerPid, process.pid);
  assert.equal(health.result.ok, true);
  assert.equal(health.result.counts.cards, 1);
  assert.ok(health.progress.length >= 3);
  assert.equal(health.progress.at(-1).percent, 100);

  const backup = await runWorker({ operation: "backup", payload: {}, config });
  assert.notEqual(backup.workerPid, process.pid);
  assert.equal(fs.existsSync(path.join(backup.result.backupPath, "dev.db")), true);
  assert.equal(fs.existsSync(path.join(backup.result.backupPath, "uploads", "card.jpg")), true);
  assert.equal(backup.progress.at(-1).percent, 100);

  const changedDb = new DatabaseSync(path.join(dataDir, "dev.db"));
  changedDb.exec("INSERT INTO Card (id) VALUES ('card-2');");
  changedDb.close();

  const preflight = await runWorker({
    operation: "restorePreflight",
    payload: { selectedPath: backup.result.datePath },
    config
  });
  assert.equal(preflight.result.sourcePath, backup.result.backupPath);
  assert.equal(preflight.result.health.integrity, "ok");

  const restore = await runWorker({
    operation: "restore",
    payload: { sourcePath: preflight.result.sourcePath },
    config
  });
  assert.notEqual(restore.workerPid, process.pid);
  assert.ok(restore.result.safetyBackupPath);
  assert.equal(restore.result.health.integrity, "ok");
  assert.equal(restore.progress.at(-1).percent, 100);

  const restoredDb = new DatabaseSync(path.join(dataDir, "dev.db"), { readOnly: true });
  const restoredCardCount = Number(restoredDb.prepare("SELECT COUNT(*) AS count FROM Card").get().count);
  restoredDb.close();
  assert.equal(restoredCardCount, 1);

  const migratedDataDir = path.join(root, "migrated-data");
  const migration = await runWorker({
    operation: "migrate",
    payload: { selectedPath: migratedDataDir },
    config
  });
  assert.notEqual(migration.workerPid, process.pid);
  assert.equal(migration.result.changed, true);
  assert.equal(migration.result.usedExistingData, false);
  assert.equal(migration.result.health.integrity, "ok");
  assert.equal(fs.existsSync(path.join(migratedDataDir, "dev.db")), true);
  assert.equal(fs.existsSync(path.join(migratedDataDir, "uploads", "card.jpg")), true);
  assert.equal(migration.progress.at(-1).percent, 100);
});
