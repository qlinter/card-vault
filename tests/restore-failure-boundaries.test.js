const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const { initializeDatabase } = require("../scripts/database-schema");
const { createRestoreService } = require("../electron/storage/restore");

test("failure after directory switch restores the original database and media", t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "card-vault-restore-boundary-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const target = path.join(root, "current"), source = path.join(root, "incoming");
  for (const [folder, name] of [[target, "original"], [source, "incoming"]]) {
    initializeDatabase(path.join(folder, "dev.db"));
    const db = new DatabaseSync(path.join(folder, "dev.db"));
    db.prepare("INSERT INTO Card(id,playerName,cardTitle,sport) VALUES(?,?,?,'Basketball')").run(name, name, name);
    db.close();
    fs.writeFileSync(path.join(folder, "marker.txt"), name);
  }
  require("../electron/storage/backup-manifest").writeBackupManifest(source);
  const service = createRestoreService({
    config: { getDataDir: () => target, getDbPath: () => path.join(target, "dev.db"), getBackupDir: () => path.join(root, "backups") },
    backupDataFolder: () => { const backupPath = path.join(root, "safety"); fs.cpSync(target, backupPath, { recursive: true }); return { backupPath }; },
    ensureDataLayout: () => { throw Object.assign(new Error("simulated disk full"), { code: "ENOSPC" }); }
  });
  assert.throws(() => service.restoreDataFolder(source), /simulated disk full/);
  const db = new DatabaseSync(path.join(target, "dev.db"), { readOnly: true });
  try { assert.equal(db.prepare("SELECT id FROM Card").get().id, "original"); }
  finally { db.close(); }
  assert.equal(fs.readFileSync(path.join(target, "marker.txt"), "utf8"), "original");
  assert.equal(fs.readFileSync(path.join(source, "marker.txt"), "utf8"), "incoming");
  assert.ok(!fs.readdirSync(root).some(name => name.includes("restore-staging") || name.includes("restore-rollback")));
});

test("restore rejects media changed during copying before switching current data", t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "card-vault-restore-copy-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const target = path.join(root, "current"), source = path.join(root, "incoming");
  for (const folder of [target, source]) initializeDatabase(path.join(folder, "dev.db"));
  fs.writeFileSync(path.join(target, "marker.txt"), "original");
  fs.writeFileSync(path.join(source, "marker.txt"), "incoming");
  require("../electron/storage/backup-manifest").writeBackupManifest(source);
  const copy = fs.cpSync;
  t.mock.method(fs, "cpSync", (from, to, options) => {
    copy(from, to, options);
    if (String(to).includes("restore-staging")) fs.writeFileSync(path.join(to, "marker.txt"), "tampered");
  });
  let switched = false;
  const service = createRestoreService({
    config: { getDataDir: () => target, getDbPath: () => path.join(target, "dev.db"), getBackupDir: () => path.join(root, "backups") },
    backupDataFolder: () => ({ backupPath: "test-backup" }),
    ensureDataLayout: () => { switched = true; }
  });
  assert.throws(() => service.restoreDataFolder(source), /备份文件校验失败/);
  assert.equal(switched, false);
  assert.equal(fs.readFileSync(path.join(target, "marker.txt"), "utf8"), "original");
  assert.equal(fs.readFileSync(path.join(source, "marker.txt"), "utf8"), "incoming");
  assert.ok(!fs.readdirSync(root).some(name => name.includes("restore-staging")));
});

test("journal write failure after preserving the original rolls back immediately", t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "card-vault-journal-full-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const target = path.join(root, "current"), source = path.join(root, "incoming");
  for (const folder of [target, source]) initializeDatabase(path.join(folder, "dev.db"));
  fs.writeFileSync(path.join(target, "marker.txt"), "original");
  require("../electron/storage/backup-manifest").writeBackupManifest(source);
  const write = fs.writeFileSync;
  t.mock.method(fs, "writeFileSync", (file, contents, options) => {
    if (String(file).includes("restore-journal") && String(contents).includes('"original-preserved"')) throw Object.assign(new Error("journal disk full"), { code: "ENOSPC" });
    return write(file, contents, options);
  });
  const service = createRestoreService({ config: { getDataDir: () => target, getDbPath: () => path.join(target, "dev.db"), getBackupDir: () => path.join(root, "backups") }, backupDataFolder: () => ({ backupPath: "safety" }), ensureDataLayout: () => { throw new Error("must not switch"); } });
  assert.throws(() => service.restoreDataFolder(source), /journal disk full/);
  assert.equal(fs.readFileSync(path.join(target, "marker.txt"), "utf8"), "original");
  assert.ok(!fs.readdirSync(root).some(name => name.includes("restore-rollback") || name.includes("restore-journal")));
});
