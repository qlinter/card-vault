const assert = require("node:assert/strict"), test = require("node:test"), fs = require("node:fs"), os = require("node:os"), path = require("node:path");
const { directoryBytes, ensureFreeSpace } = require("../electron/storage/free-space");
const { createStorageManager } = require("../electron/storage");
const { initializeDatabase } = require("../scripts/database-schema");

test("legacy automatic preferences are ignored and all existing backups remain restorable", t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "card-vault-legacy-backup-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const options = { appDataRoot: root, projectRoot: path.resolve(__dirname, "..") };
  const manager = createStorageManager(options);
  initializeDatabase(manager.getDbPath());
  const configPath = path.join(root, "storage-config.json");
  const legacyPreferences = { enabled: true, keep: 1 };
  fs.writeFileSync(configPath, JSON.stringify({ automaticBackup: legacyPreferences }));
  const { writeBackupManifest, verifyBackupManifest } = require("../electron/storage/backup-manifest");
  const legacy = manager.backupDataFolder();
  writeBackupManifest(legacy.backupPath, { automatic: true, sourceKey: "legacy-library" });
  const legacyManifest = fs.readFileSync(path.join(legacy.backupPath, "backup-manifest.json"), "utf8");
  const next = require("../electron/storage-task").runStorageTask({ operation: "backup", config: options, payload: { automatic: true } });
  const manual = manager.backupDataFolder();
  for (const result of [legacy, next, manual]) assert.ok(verifyBackupManifest(result.backupPath).verified);
  assert.equal(JSON.parse(fs.readFileSync(path.join(next.backupPath, "backup-manifest.json"), "utf8")).automatic, undefined);
  assert.equal(manager.getBackupSettings().automatic, undefined);
  assert.equal(manager.saveAutomaticBackupSettings, undefined);
  const restored = manager.restoreDataFolder(legacy.backupPath);
  assert.equal(restored.restoredFrom, legacy.backupPath);
  assert.equal(fs.readFileSync(path.join(legacy.backupPath, "backup-manifest.json"), "utf8"), legacyManifest);
  assert.ok(fs.existsSync(next.backupPath));
  assert.ok(fs.existsSync(manual.backupPath));
  assert.deepEqual(JSON.parse(fs.readFileSync(configPath, "utf8")).automaticBackup, legacyPreferences);
});

test("space preflight includes reserve and checks an existing parent without creating output", t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "card-vault-space-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.writeFileSync(path.join(root, "test"), "1234");
  assert.equal(directoryBytes(root), 4n);
  const destination = path.join(root, "not-created", "backup");
  assert.throws(() => ensureFreeSpace(destination, 4n, () => ({ bavail: 0n, bsize: 4096n })), /磁盘空间不足/);
  assert.ok(!fs.existsSync(destination));
  assert.ok(BigInt(ensureFreeSpace(destination, 4n, () => ({ bavail: 1000000n, bsize: 4096n })).requiredBytes) > 4n);
});

test("successful backup metadata survives a restart and is scoped to the data directory", t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "card-vault-backup-status-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const options = { appDataRoot: root, projectRoot: path.resolve(__dirname, "..") };
  const manager = createStorageManager(options);
  initializeDatabase(manager.getDbPath());
  manager.ensureDataLayout(manager.getDataDir());
  fs.writeFileSync(path.join(manager.getUploadsDir(), "draft-test.png"), "draft image");
  const { DatabaseSync } = require("node:sqlite");
  const db = new DatabaseSync(manager.getDbPath());
  db.prepare("INSERT INTO CardEntryDraft(id,valuesJson) VALUES('draft',?)").run(JSON.stringify({ draftImages: [{ path: "/media/draft-test.png", name: "test.png", rotation: 90 }] }));
  db.close();
  assert.deepEqual(manager.inspectDataFolder().orphanFiles, []);
  assert.equal(manager.getBackupSettings().lastBackup, null);
  const result = manager.backupDataFolder();
  const reopened = createStorageManager(options);
  const last = reopened.getBackupSettings().lastBackup;
  assert.equal(last.path, result.backupPath);
  assert.ok(last.verified && last.available && last.bytes > 0);
  assert.equal(last.imageCount, 1);
  fs.renameSync(path.join(result.backupPath, "backup-manifest.json"), path.join(result.backupPath, "manifest-moved.json"));
  assert.equal(reopened.getBackupSettings().lastBackup.available, false);
  const stat = fs.statSync;
  const dbPath = manager.getDbPath();
  t.mock.method(fs, "statSync", (target, options) => {
    const value = stat(target, options);
    return target === dbPath ? Object.assign(Object.create(Object.getPrototypeOf(value)), value, { birthtimeMs: value.birthtimeMs + 1000 }) : value;
  });
  assert.equal(reopened.getBackupSettings().lastBackup, null, "Restoring a different database at the same path must not inherit the old backup status.");
  const configPath = path.join(root, "storage-config.json");
  const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  fs.writeFileSync(configPath, JSON.stringify({ ...config, dataDir: path.join(root, "other") }));
  assert.equal(reopened.getBackupSettings().lastBackup, null);
});
