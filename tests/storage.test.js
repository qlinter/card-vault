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
  const schemaBackupsDir = path.join(manager.getDataDir(), "schema-backups");
  fs.mkdirSync(schemaBackupsDir, { recursive: true });
  fs.writeFileSync(path.join(schemaBackupsDir, "before-migration.db"), "snapshot");

  const sourceUploadsDir = manager.getUploadsDir();
  const targetDir = path.join(root, "migrated-data");
  manager.migrateTo(targetDir);

  assert.equal(fs.readFileSync(path.join(targetDir, "uploads", "card.jpg"), "utf8"), "card");
  assert.equal(fs.readFileSync(path.join(targetDir, "share-covers", "cover.jpg"), "utf8"), "cover");
  assert.equal(fs.readFileSync(path.join(targetDir, "share-backgrounds", "background.jpg"), "utf8"), "background");
  assert.equal(fs.readFileSync(path.join(targetDir, "schema-backups", "before-migration.db"), "utf8"), "snapshot");
  assert.equal(fs.existsSync(path.join(targetDir, "dev.db")), true);
  assert.equal(fs.existsSync(path.join(sourceUploadsDir, "card.jpg")), true);
});

test("storage migration snapshots committed WAL data while the source database is open", (t) => {
  const { root, manager } = createTestManager(t);
  seedCardVaultData(manager, "Original Player");
  const sourceDbPath = manager.getDbPath();
  const sourceDb = new DatabaseSync(sourceDbPath);
  sourceDb.exec("PRAGMA journal_mode = WAL;");
  sourceDb.exec("PRAGMA wal_autocheckpoint = 0;");
  sourceDb.prepare("INSERT INTO Card (id, playerName, cardTitle, sport) VALUES (?, ?, ?, ?)")
    .run("card-wal", "WAL Player", "Committed in WAL", "Basketball");
  assert.equal(fs.existsSync(`${sourceDbPath}-wal`), true);

  const targetDir = path.join(root, "wal-migrated-data");
  let result;
  try {
    result = manager.migrateTo(targetDir);
  } finally {
    sourceDb.close();
  }
  const migratedDb = new DatabaseSync(path.join(targetDir, "dev.db"), { readOnly: true });
  const migrated = migratedDb.prepare("SELECT playerName FROM Card WHERE id = ?").get("card-wal");
  migratedDb.close();

  assert.equal(result.health.integrity, "ok");
  assert.equal(migrated.playerName, "WAL Player");
  assert.equal(fs.existsSync(sourceDbPath), true);
});

test("storage migration rejects a non-empty unrelated destination", (t) => {
  const { root, manager } = createTestManager(t);
  seedData(manager);
  const originalPath = manager.getDataDir();
  const targetDir = path.join(root, "unrelated-files");
  fs.mkdirSync(targetDir, { recursive: true });
  fs.writeFileSync(path.join(targetDir, "keep.txt"), "keep");

  assert.throws(() => manager.migrateTo(targetDir), /不是空文件夹/);
  assert.equal(manager.getDataDir(), originalPath);
  assert.equal(fs.readFileSync(path.join(targetDir, "keep.txt"), "utf8"), "keep");
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

test("legacy uploads paths remain referenced during health checks and cleanup", (t) => {
  const { manager } = createTestManager(t);
  seedCardVaultData(manager);

  const db = new DatabaseSync(manager.getDbPath());
  db.prepare("UPDATE CardImage SET path = ? WHERE id = ?").run("/uploads/card.jpg", "image-1");
  db.close();

  const health = manager.inspectDataFolder();
  assert.equal(health.ok, true);
  assert.equal(health.missingFiles.length, 0);
  assert.equal(health.orphanFiles.some((file) => file.path === path.join("uploads", "card.jpg")), false);

  const cleanup = manager.cleanOrphanFiles();
  assert.equal(cleanup.deletedFiles.length, 0);
  assert.equal(fs.existsSync(path.join(manager.getUploadsDir(), "card.jpg")), true);
});

test("entry queue sources and processed images remain referenced during health checks", (t) => {
  const { manager } = createTestManager(t);
  seedCardVaultData(manager);
  const queueDir = path.join(manager.getDataDir(), "entry-queue");
  const processedPath = path.join(manager.getUploadsDir(), "queue-image.webp");
  const sourcePath = path.join(queueDir, "queue-source.png");
  fs.mkdirSync(queueDir, { recursive: true });
  fs.writeFileSync(processedPath, "processed");
  fs.writeFileSync(sourcePath, "source");

  const db = new DatabaseSync(manager.getDbPath());
  db.prepare("INSERT INTO CardEntryBatch (id, label, pairingMode) VALUES (?, ?, ?)")
    .run("queue-batch", "Queue Batch", "pairs");
  db.prepare("INSERT INTO CardEntryQueueItem (id, batchId, status, sortOrder, attemptCount) VALUES (?, ?, ?, ?, ?)")
    .run("queue-item", "queue-batch", "failed", 0, 1);
  db.prepare(`
    INSERT INTO CardEntryQueueImage (
      id, itemId, originalName, sourcePath, processedPath, side, sortOrder, mimeType, originalBytes, processedBytes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run("queue-image", "queue-item", "source.png", "queue-source.png", "/media/queue-image.webp", "front", 0, "image/png", 100, 80);
  db.close();

  const health = manager.inspectDataFolder();
  assert.equal(health.ok, true);
  assert.equal(health.counts.queueItems, 1);
  assert.equal(health.missingFiles.length, 0);
  assert.equal(health.orphanFiles.some((file) => file.path === path.join("uploads", "queue-image.webp")), false);
  assert.equal(health.orphanFiles.some((file) => file.path === path.join("entry-queue", "queue-source.png")), false);

  fs.rmSync(sourcePath);
  const missingSource = manager.inspectDataFolder();
  assert.equal(missingSource.ok, false);
  assert.equal(missingSource.missingFiles.some((file) => file.type === "queueSource"), true);
});

test("orphan cleanup removes only media that is not referenced by the database", (t) => {
  const { manager } = createTestManager(t);
  seedCardVaultData(manager);
  const orphanPaths = [
    path.join(manager.getUploadsDir(), "orphan-card.jpg"),
    path.join(manager.getShareCoversDir(), "orphan-cover.jpg"),
    path.join(manager.getShareBackgroundsDir(), "orphan-background.jpg"),
    path.join(manager.getDataDir(), "entry-queue", "orphan-source.png")
  ];
  for (const orphanPath of orphanPaths) {
    fs.writeFileSync(orphanPath, "orphan");
  }

  const result = manager.cleanOrphanFiles();

  assert.equal(result.deletedFiles.length, 4);
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

test("v1.0.15-compatible backup restores without migration after creating a safety backup", (t) => {
  const { root, manager } = createTestManager(t);
  seedCardVaultData(manager, "Before Backup");
  const sourceDb = new DatabaseSync(manager.getDbPath());
  sourceDb.prepare(`
    INSERT INTO CardValuation (id, cardId, amountMinor, currency, valuedAt, source, provenance)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run("v1015-valuation", "card-1", 12345, "CNY", "2026-08-12", "个人估计", "manual");
  sourceDb.close();
  manager.chooseBackupDir(path.join(root, "backups"));
  const sourceBackup = manager.backupDataFolder();

  const currentDb = new DatabaseSync(manager.getDbPath());
  currentDb.prepare("UPDATE Card SET playerName = ? WHERE id = ?").run("Changed After Backup", "card-1");
  currentDb.close();

  const restored = manager.restoreDataFolder(sourceBackup.backupPath);
  const restoredDb = new DatabaseSync(manager.getDbPath(), { readOnly: true });
  const card = restoredDb.prepare("SELECT playerName FROM Card WHERE id = ?").get("card-1");
  const valuation = restoredDb.prepare("SELECT amountMinor, source FROM CardValuation WHERE id = ?").get("v1015-valuation");
  restoredDb.close();

  assert.equal(card.playerName, "Before Backup");
  assert.equal(valuation.amountMinor, 12345);
  assert.equal(valuation.source, "个人估计");
  assert.deepEqual(restored.appliedMigrations, []);
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

test("restore migrates an older backup before replacing current data", (t) => {
  const { root, manager } = createTestManager(t);
  seedCardVaultData(manager, "Current Player");
  manager.chooseBackupDir(path.join(root, "backups"));
  const oldBackup = manager.backupDataFolder();

  const backupDb = new DatabaseSync(path.join(oldBackup.backupPath, "dev.db"));
  backupDb.prepare("INSERT INTO CardValuation (id, cardId, amountMinor, currency, valuedAt, source, provenance) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .run("old-valuation", "card-1", 12345, "CNY", "2025-01-01", "平台报价", "manual");
  backupDb.prepare("UPDATE Card SET isSerialNumbered = 0, serialNumber = ?, serialRange = ? WHERE id = ?")
    .run("12", "/99", "card-1");
  backupDb.prepare("DELETE FROM SchemaMigration WHERE id IN (?, ?)")
    .run("007_normalize_valuation_sources_v1_1_0", "009_backfill_serial_numbered_v1_0_19");
  backupDb.close();

  const restored = manager.restoreDataFolder(oldBackup.backupPath);
  const restoredDb = new DatabaseSync(manager.getDbPath(), { readOnly: true });
  const valuation = restoredDb.prepare("SELECT source FROM CardValuation WHERE id = ?").get("old-valuation");
  const card = restoredDb.prepare("SELECT isSerialNumbered FROM Card WHERE id = ?").get("card-1");
  const latestMigration = restoredDb.prepare("SELECT id FROM SchemaMigration ORDER BY appliedAt DESC, rowid DESC LIMIT 1").get();
  restoredDb.close();

  assert.deepEqual(restored.appliedMigrations, [
    "007_normalize_valuation_sources_v1_1_0",
    "009_backfill_serial_numbered_v1_0_19"
  ]);
  assert.equal(restored.schemaVersion, "012_card_entry_workbench_phase3_v1_1_0");
  assert.equal(valuation.source, "个人估计");
  assert.equal(card.isSerialNumbered, 1);
  assert.equal(latestMigration.id, "009_backfill_serial_numbered_v1_0_19");
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
