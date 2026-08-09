const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { DatabaseSync } = require("node:sqlite");
const { createStorageManager } = require("../electron/storage");
const { initializeDatabase } = require("../scripts/database-migrations");

function createTestManager(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "card-vault-storage-test-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  const appDataRoot = path.join(root, "app-data");
  const projectRoot = path.join(root, "project");
  fs.mkdirSync(projectRoot, { recursive: true });
  return {
    root,
    appDataRoot,
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

function seedCardVaultData(manager, playerName = "Card Vault Player") {
  manager.repairDataLayout(manager.getDataDir());
  initializeDatabase(manager.getDbPath());
  fs.writeFileSync(path.join(manager.getUploadsDir(), "card.jpg"), "card-image");
  fs.writeFileSync(path.join(manager.getShareCoversDir(), "cover.jpg"), "cover-image");
  fs.writeFileSync(path.join(manager.getShareBackgroundsDir(), "background.jpg"), "background-image");

  const db = new DatabaseSync(manager.getDbPath());
  db.prepare("INSERT INTO Card (id, playerName, cardTitle, sport) VALUES (?, ?, ?, ?)")
    .run("card-1", playerName, "Test Card", "Basketball");
  db.prepare("INSERT INTO CardImage (id, cardId, path) VALUES (?, ?, ?)")
    .run("image-1", "card-1", "/media/card.jpg");
  db.prepare(`
    INSERT INTO ShareCollection (id, title, slug, coverImagePath, backgroundImagePath)
    VALUES (?, ?, ?, ?, ?)
  `).run("share-1", "Test Share", "test-share", "/share-covers/cover.jpg", "/share-backgrounds/background.jpg");
  db.close();
}

test("storage migration includes share backgrounds", (t) => {
  const { root, manager } = createTestManager(t);
  seedData(manager);

  const sourceUploadsDir = manager.getUploadsDir();
  const targetDir = path.join(root, "migrated-data");
  manager.migrateTo(targetDir);

  assert.equal(fs.readFileSync(path.join(targetDir, "uploads", "card.jpg"), "utf8"), "card");
  assert.equal(fs.readFileSync(path.join(targetDir, "share-covers", "cover.jpg"), "utf8"), "cover");
  assert.equal(fs.readFileSync(path.join(targetDir, "share-backgrounds", "background.jpg"), "utf8"), "background");
  assert.equal(fs.existsSync(path.join(targetDir, "dev.db")), true);
  assert.equal(fs.existsSync(path.join(sourceUploadsDir, "card.jpg")), true);
});

test("switching to existing storage preserves its database and media", (t) => {
  const { root, manager } = createTestManager(t);
  seedData(manager);

  const sourceUploadsDir = manager.getUploadsDir();
  const targetDir = path.join(root, "existing-data");
  const targetUploadsDir = path.join(targetDir, "uploads");
  fs.mkdirSync(targetUploadsDir, { recursive: true });
  fs.writeFileSync(path.join(targetUploadsDir, "existing.jpg"), "existing");

  const targetDb = new DatabaseSync(path.join(targetDir, "dev.db"));
  targetDb.exec("CREATE TABLE Sample (id INTEGER PRIMARY KEY, name TEXT NOT NULL);");
  targetDb.prepare("INSERT INTO Sample (name) VALUES (?)").run("Existing collection");
  targetDb.close();

  const result = manager.migrateTo(targetDir);
  const reopenedTargetDb = new DatabaseSync(path.join(targetDir, "dev.db"), { readOnly: true });
  const row = reopenedTargetDb.prepare("SELECT name FROM Sample").get();
  reopenedTargetDb.close();

  assert.equal(result.usedExistingData, true);
  assert.equal(row.name, "Existing collection");
  assert.equal(fs.readFileSync(path.join(targetUploadsDir, "existing.jpg"), "utf8"), "existing");
  assert.equal(fs.existsSync(path.join(targetUploadsDir, "card.jpg")), false);
  assert.equal(fs.existsSync(path.join(sourceUploadsDir, "card.jpg")), true);
});

test("legacy pending cleanup is cancelled without deleting old data", (t) => {
  const { appDataRoot, manager } = createTestManager(t);
  seedData(manager);

  const sourceDataDir = manager.getDataDir();
  const cleanupConfigPath = path.join(appDataRoot, "cleanup-config.json");
  fs.mkdirSync(appDataRoot, { recursive: true });
  fs.writeFileSync(cleanupConfigPath, JSON.stringify({ pendingDeleteDir: sourceDataDir }));

  manager.runPendingCleanup();

  assert.equal(fs.existsSync(path.join(sourceDataDir, "dev.db")), true);
  assert.equal(fs.existsSync(path.join(sourceDataDir, "uploads", "card.jpg")), true);
  assert.equal(fs.existsSync(cleanupConfigPath), false);
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

test("data health reports missing references and unreferenced media", (t) => {
  const { manager } = createTestManager(t);
  seedCardVaultData(manager);
  fs.writeFileSync(path.join(manager.getUploadsDir(), "orphan.jpg"), "orphan");

  const healthy = manager.inspectDataFolder();
  assert.equal(healthy.integrity, "ok");
  assert.equal(healthy.counts.cards, 1);
  assert.equal(healthy.missingFiles.length, 0);
  assert.equal(healthy.orphanFiles.some((file) => file.path === path.join("uploads", "orphan.jpg")), true);

  fs.rmSync(path.join(manager.getUploadsDir(), "card.jpg"));
  const unhealthy = manager.inspectDataFolder();
  assert.equal(unhealthy.ok, false);
  assert.equal(unhealthy.missingFiles.length, 1);
});

test("orphan cleanup removes only media that is not referenced by the database", (t) => {
  const { manager } = createTestManager(t);
  seedCardVaultData(manager);
  const orphanPaths = [
    path.join(manager.getUploadsDir(), "orphan-card.jpg"),
    path.join(manager.getShareCoversDir(), "orphan-cover.jpg"),
    path.join(manager.getShareBackgroundsDir(), "orphan-background.jpg")
  ];
  for (const orphanPath of orphanPaths) {
    fs.writeFileSync(orphanPath, "orphan");
  }

  const result = manager.cleanOrphanFiles();

  assert.equal(result.deletedFiles.length, 3);
  assert.equal(result.failedFiles.length, 0);
  assert.equal(result.health.orphanFiles.length, 0);
  assert.equal(fs.existsSync(path.join(manager.getUploadsDir(), "card.jpg")), true);
  assert.equal(fs.existsSync(path.join(manager.getShareCoversDir(), "cover.jpg")), true);
  assert.equal(fs.existsSync(path.join(manager.getShareBackgroundsDir(), "background.jpg")), true);
  for (const orphanPath of orphanPaths) {
    assert.equal(fs.existsSync(orphanPath), false);
  }
});

test("orphan file reveal resolves only current files in managed media directories", (t) => {
  const { manager } = createTestManager(t);
  seedCardVaultData(manager);
  const orphanPath = path.join(manager.getUploadsDir(), "orphan.jpg");
  const relativeOrphanPath = path.join("uploads", "orphan.jpg");
  fs.writeFileSync(orphanPath, "orphan");

  assert.equal(
    manager.resolveOrphanFilePath({ type: "cardImage", path: relativeOrphanPath }),
    orphanPath
  );
  assert.equal(
    manager.resolveOrphanFilePath({ type: "cardImage", path: path.join("uploads", "card.jpg") }),
    null
  );
  assert.equal(
    manager.resolveOrphanFilePath({ type: "shareCover", path: relativeOrphanPath }),
    null
  );
  assert.equal(
    manager.resolveOrphanFilePath({ type: "cardImage", path: path.join("..", "outside.jpg") }),
    null
  );
});

test("orphan cleanup is refused when the data health check does not pass", (t) => {
  const { manager } = createTestManager(t);
  seedCardVaultData(manager);
  const orphanPath = path.join(manager.getUploadsDir(), "orphan.jpg");
  fs.writeFileSync(orphanPath, "orphan");
  fs.rmSync(path.join(manager.getUploadsDir(), "card.jpg"));

  assert.throws(() => manager.cleanOrphanFiles(), /数据健康检查未通过/);
  assert.equal(fs.existsSync(orphanPath), true);
});

test("restore replaces current data only after creating a safety backup", (t) => {
  const { root, manager } = createTestManager(t);
  seedCardVaultData(manager, "Before Backup");
  manager.chooseBackupDir(path.join(root, "backups"));
  const sourceBackup = manager.backupDataFolder();

  const currentDb = new DatabaseSync(manager.getDbPath());
  currentDb.prepare("UPDATE Card SET playerName = ? WHERE id = ?").run("Changed After Backup", "card-1");
  currentDb.close();

  const restored = manager.restoreDataFolder(sourceBackup.backupPath);
  const restoredDb = new DatabaseSync(manager.getDbPath(), { readOnly: true });
  const card = restoredDb.prepare("SELECT playerName FROM Card WHERE id = ?").get("card-1");
  restoredDb.close();

  assert.equal(card.playerName, "Before Backup");
  assert.ok(restored.safetyBackupPath);
  assert.equal(fs.existsSync(path.join(restored.safetyBackupPath, "dev.db")), true);
  assert.equal(restored.health.integrity, "ok");
});

test("restore accepts a dated backup folder and selects its latest backup", (t) => {
  const { root, manager } = createTestManager(t);
  seedCardVaultData(manager, "First Backup");
  manager.chooseBackupDir(path.join(root, "backups"));
  const firstBackup = manager.backupDataFolder();

  const currentDb = new DatabaseSync(manager.getDbPath());
  currentDb.prepare("UPDATE Card SET playerName = ? WHERE id = ?").run("Latest Backup", "card-1");
  currentDb.close();
  const latestBackup = manager.backupDataFolder();
  const now = new Date();
  fs.utimesSync(firstBackup.backupPath, new Date(now.getTime() - 10_000), new Date(now.getTime() - 10_000));
  fs.utimesSync(latestBackup.backupPath, now, now);

  const changedDb = new DatabaseSync(manager.getDbPath());
  changedDb.prepare("UPDATE Card SET playerName = ? WHERE id = ?").run("Changed After Backup", "card-1");
  changedDb.close();

  const restored = manager.restoreDataFolder(latestBackup.datePath);
  const restoredDb = new DatabaseSync(manager.getDbPath(), { readOnly: true });
  const card = restoredDb.prepare("SELECT playerName FROM Card WHERE id = ?").get("card-1");
  restoredDb.close();

  assert.equal(restored.restoredFrom, latestBackup.backupPath);
  assert.equal(card.playerName, "Latest Backup");
});

test("restore rejects folders that do not contain a generated backup", (t) => {
  const { root, manager } = createTestManager(t);
  seedCardVaultData(manager);
  const emptyFolder = path.join(root, "empty-backup");
  fs.mkdirSync(emptyFolder, { recursive: true });

  assert.throws(() => manager.restoreDataFolder(emptyFolder), /未找到可恢复的 dev\.db/);
});

test("restore preserves a raw safety copy when the current database is corrupted", (t) => {
  const { root, manager } = createTestManager(t);
  seedCardVaultData(manager, "Healthy Backup");
  manager.chooseBackupDir(path.join(root, "backups"));
  const sourceBackup = manager.backupDataFolder();

  fs.writeFileSync(manager.getDbPath(), "not-a-sqlite-database");
  const restored = manager.restoreDataFolder(sourceBackup.backupPath);

  assert.ok(restored.safetyBackupPath);
  assert.equal(fs.readFileSync(path.join(restored.safetyBackupPath, "dev.db"), "utf8"), "not-a-sqlite-database");
  assert.equal(restored.health.integrity, "ok");
});
