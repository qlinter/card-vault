const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { DatabaseSync } = require("node:sqlite");
const { createStorageManager } = require("../electron/storage");

function createTestManager(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "card-vault-storage-test-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  const appDataRoot = path.join(root, "app-data");
  const projectRoot = path.join(root, "project");
  fs.mkdirSync(projectRoot, { recursive: true });
  return {
    root,
    manager: createStorageManager({ appDataRoot, projectRoot, log: () => {} })
  };
}

function seedData(manager) {
  manager.repairDataLayout(manager.getDataDir());
  fs.writeFileSync(path.join(manager.getUploadsDir(), "card.jpg"), "card");
  fs.writeFileSync(path.join(manager.getShareCoversDir(), "cover.jpg"), "cover");
  fs.writeFileSync(path.join(manager.getShareBackgroundsDir(), "background.jpg"), "background");

  const db = new DatabaseSync(manager.getDbPath());
  db.exec("CREATE TABLE Sample (id INTEGER PRIMARY KEY, name TEXT NOT NULL);");
  db.prepare("INSERT INTO Sample (name) VALUES (?)").run("Card Vault");
  db.close();
}

test("storage migration includes share backgrounds", (t) => {
  const { root, manager } = createTestManager(t);
  seedData(manager);

  const targetDir = path.join(root, "migrated-data");
  manager.migrateTo(targetDir);

  assert.equal(fs.readFileSync(path.join(targetDir, "uploads", "card.jpg"), "utf8"), "card");
  assert.equal(fs.readFileSync(path.join(targetDir, "share-covers", "cover.jpg"), "utf8"), "cover");
  assert.equal(fs.readFileSync(path.join(targetDir, "share-backgrounds", "background.jpg"), "utf8"), "background");
  assert.equal(fs.existsSync(path.join(targetDir, "dev.db")), true);
});

test("backup creates an integrity-checked SQLite snapshot and copies media", (t) => {
  const { root, manager } = createTestManager(t);
  seedData(manager);

  manager.chooseBackupDir(path.join(root, "backups"));
  const result = manager.backupDataFolder();
  const backupDb = new DatabaseSync(path.join(result.backupPath, "dev.db"), { readOnly: true });
  const row = backupDb.prepare("SELECT name FROM Sample").get();
  backupDb.close();

  assert.equal(row.name, "Card Vault");
  assert.equal(
    fs.readFileSync(path.join(result.backupPath, "share-backgrounds", "background.jpg"), "utf8"),
    "background"
  );
});
