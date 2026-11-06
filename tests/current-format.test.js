const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"), os = require("node:os"), path = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const { initializeDatabase, validateDatabase } = require("../scripts/database-schema");
const { writeBackupManifest, verifyBackupManifest } = require("../electron/storage/backup-manifest");
const { createRestoreService } = require("../electron/storage/restore");

function fixture(t, extraTable = false) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "card-vault-current-format-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const data = path.join(root, "data"); fs.mkdirSync(data);
  const file = path.join(data, "dev.db"), db = new DatabaseSync(file);
  db.exec(fs.readFileSync(path.join(__dirname, "fixtures/current-format-v1.5.1.sql"), "utf8"));
  db.exec("INSERT INTO Card(id,playerName,cardTitle,sport) VALUES('kept','Player','Kept card','Basketball')");
  if (extraTable) db.exec("CREATE TABLE CollectionRecap(id TEXT PRIMARY KEY, title TEXT); INSERT INTO CollectionRecap VALUES('extra','Unused content')");
  db.close();
  return { root, data, file };
}

for (const extraTable of [false, true]) {
  test(`published 1.5.1 data opens without schema or content changes (extra table: ${extraTable})`, t => {
    const f = fixture(t, extraTable), before = fs.readFileSync(f.file);
    validateDatabase(f.file);
    assert.equal(initializeDatabase(f.file).initialized, false);
    assert.equal(initializeDatabase(f.file).initialized, false);
    assert.deepEqual(fs.readFileSync(f.file), before);
    assert.equal(fs.existsSync(path.join(f.data, "schema-backups")), false);
  });

  test(`restore preserves the current format and ignores unused tables (extra table: ${extraTable})`, t => {
    const f = fixture(t, extraTable), before = fs.readFileSync(f.file);
    writeBackupManifest(f.data);
    const target = path.join(f.root, "restored");
    const service = createRestoreService({
      config: { getDataDir: () => target, getDbPath: () => path.join(target, "dev.db") },
      backupDataFolder: () => { throw new Error("No existing target"); },
      ensureDataLayout: directory => initializeDatabase(path.join(directory, "dev.db"))
    });
    service.restoreDataFolder(f.data);
    verifyBackupManifest(f.data); verifyBackupManifest(target);
    assert.deepEqual(fs.readFileSync(f.file), before);
    assert.deepEqual(fs.readFileSync(path.join(target, "dev.db")), before);
  });
}

test("new databases do not create retired recap storage", t => {
  const f = fixture(t), file = path.join(f.root, "new.db");
  initializeDatabase(file);
  const db = new DatabaseSync(file, { readOnly: true });
  try { assert.equal(db.prepare("SELECT name FROM sqlite_master WHERE name='CollectionRecap'").get(), undefined); }
  finally { db.close(); }
});

test("obsolete valuation constraints are rejected before startup or restore writes", t => {
  const f = fixture(t), db = new DatabaseSync(f.file);
  const definition = db.prepare("SELECT sql FROM sqlite_master WHERE name='CardValuation'").get().sql;
  const objects = db.prepare("SELECT sql FROM sqlite_master WHERE tbl_name='CardValuation' AND type IN ('index','trigger') AND sql IS NOT NULL").all();
  db.exec("DROP TABLE CardValuation");
  db.exec(definition.replace("'个人估计', '卡淘', 'eBay', 'Others'", "'个人估计', '近期成交', '平台报价'"));
  for (const object of objects) db.exec(object.sql);
  db.close();
  const before = fs.readFileSync(f.file);
  assert.throws(() => initializeDatabase(f.file), /估值来源约束/);
  writeBackupManifest(f.data);
  const target = path.join(f.root, "restored");
  const service = createRestoreService({ config: { getDataDir: () => target }, backupDataFolder: () => assert.fail("Must reject before backing up or replacing current data"), ensureDataLayout: () => {} });
  assert.throws(() => service.restoreDataFolder(f.data), /估值来源约束/);
  assert.equal(fs.existsSync(target), false);
  assert.deepEqual(fs.readFileSync(f.file), before);
});
