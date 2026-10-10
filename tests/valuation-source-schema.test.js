const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const { initializeDatabase, validateDatabase } = require("../scripts/database-schema");
const { normalizeValuationSourceSchema } = require("../scripts/valuation-source-schema");
const { writeBackupManifest, verifyBackupManifest } = require("../electron/storage/backup-manifest");
const { createRestoreService } = require("../electron/storage/restore");
const { ensureDataLayout } = require("../electron/storage/layout");

function legacyFixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "card-vault-sources-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const data = path.join(root, "data"), database = path.join(data, "dev.db");
  initializeDatabase(database);
  const db = new DatabaseSync(database);
  const table = db.prepare("SELECT sql FROM sqlite_master WHERE name='CardValuation'").get().sql;
  const objects = db.prepare("SELECT sql FROM sqlite_master WHERE tbl_name='CardValuation' AND sql IS NOT NULL AND type IN ('index','trigger')").all();
  db.exec("DROP TABLE CardValuation");
  db.exec(table.replace("'个人估计', '卡淘', 'eBay', 'Others'", "'个人估计', '近期成交', '平台报价'"));
  for (const object of objects) db.exec(object.sql);
  db.exec("ALTER TABLE CardValuation ADD COLUMN legacyReference TEXT; INSERT INTO Card(id,playerName,cardTitle,sport) VALUES('card','Player','Card','Basketball'); INSERT INTO CardTransaction(id,cardId,kind,amountMinor,occurredAt,source,provenance) VALUES('buy','card','purchase',999,'2026-01-01','近期成交','manual')");
  const insert = db.prepare("INSERT INTO CardValuation(id,cardId,amountMinor,currency,valuedAt,source,notes,provenance,externalKey,createdAt,updatedAt,legacyReference) VALUES(?,'card',12345,'USD','2026-02-02',?,'平台报价是当时的备注','import',?,'2026-02-03','2026-02-04','keep-extra-column')");
  insert.run("sale", "近期成交", "external-sale"); insert.run("platform", "平台报价", "external-platform"); insert.run("personal", "个人估计", "external-personal");
  db.prepare("INSERT INTO CardEntryDraft(id,valuesJson) VALUES('draft',?)").run(JSON.stringify({ valuationSource: "近期成交", notes: "近期成交" }));
  db.prepare("INSERT INTO CardEntryTemplate(id,name,valuesJson) VALUES('template','Template',?)").run(JSON.stringify({ valuationSource: "平台报价" }));
  db.prepare("INSERT INTO PortfolioSnapshotRecord(id,name,queryJson,snapshotJson) VALUES('snapshot','Snapshot','{}',?)").run(JSON.stringify({ financials: { valuationSources: [{ name: "近期成交", count: 2 }, { name: "卡淘", count: 1 }, { name: "平台报价", count: 1 }] } }));
  db.exec("INSERT INTO BulkJob(id,token,kind,optionsJson) VALUES('job','token','import','{}')");
  db.prepare("INSERT INTO BulkJobRow(id,jobId,rowNumber,inputJson,beforeJson,afterJson) VALUES('row','job',1,?,?,?)").run(JSON.stringify({ valuationSource: "近期成交" }), JSON.stringify({ transactions: [{ source: "平台报价" }], valuations: [{ source: "近期成交" }] }), JSON.stringify({ type: "valuation", source: "平台报价" }));
  const before = db.prepare("SELECT * FROM CardValuation ORDER BY id").all(); db.close();
  return { root, data, database, before };
}

test("source conversion preserves financial fields, extra columns, indexes and triggers; backs up and is idempotent", t => {
  const fixture = legacyFixture(t);
  const result = initializeDatabase(fixture.database).sourceUpdate;
  assert.equal(result.valuations, 2); assert.equal(result.storedRecords, 6); assert.equal(result.changed, true);
  validateDatabase(fixture.database);
  const db = new DatabaseSync(fixture.database);
  try {
    const expected = fixture.before.map(row => ({ ...row, source: row.source === "近期成交" ? "卡淘" : row.source === "平台报价" ? "Others" : row.source }));
    assert.deepEqual(db.prepare("SELECT * FROM CardValuation ORDER BY id").all().map(row => ({ ...row })), expected);
    assert.equal(db.prepare("SELECT source FROM CardTransaction").get().source, "近期成交");
    assert.deepEqual(JSON.parse(db.prepare("SELECT valuesJson FROM CardEntryDraft").get().valuesJson), { valuationSource: "卡淘", notes: "近期成交" });
    assert.equal(JSON.parse(db.prepare("SELECT afterJson FROM BulkJobRow").get().afterJson).source, "Others");
    const before = JSON.parse(db.prepare("SELECT beforeJson FROM BulkJobRow").get().beforeJson);
    assert.equal(before.transactions[0].source, "平台报价"); assert.equal(before.valuations[0].source, "卡淘");
    assert.deepEqual(JSON.parse(db.prepare("SELECT snapshotJson FROM PortfolioSnapshotRecord").get().snapshotJson).financials.valuationSources, [{ name: "卡淘", count: 3 }, { name: "Others", count: 1 }]);
    for (const source of ["卡淘", "eBay", "Others"]) db.prepare("UPDATE CardValuation SET source=? WHERE id='sale'").run(source);
    for (const source of ["近期成交", "平台报价"]) assert.throws(() => db.prepare("UPDATE CardValuation SET source=? WHERE id='sale'").run(source), /CHECK constraint/);
    assert.ok(db.prepare("SELECT valuationRevision FROM CardTracking WHERE cardId='card'").get().valuationRevision > 0);
  } finally { db.close(); }
  const backup = new DatabaseSync(result.backupPath, { readOnly: true });
  try { assert.deepEqual(backup.prepare("SELECT * FROM CardValuation ORDER BY id").all(), fixture.before); } finally { backup.close(); }
  assert.equal(normalizeValuationSourceSchema(fixture.database).changed, false);
  assert.equal(fs.readdirSync(path.dirname(result.backupPath)).length, 1);
});

test("a failed stored-record update rolls back both schema and valuation changes", t => {
  const fixture = legacyFixture(t);
  const db = new DatabaseSync(fixture.database);
  db.exec("CREATE TRIGGER fail_source_update BEFORE UPDATE ON CardEntryDraft BEGIN SELECT RAISE(ABORT,'test update failure'); END"); db.close();
  assert.throws(() => normalizeValuationSourceSchema(fixture.database), /test update failure/);
  const original = new DatabaseSync(fixture.database);
  try { assert.deepEqual(original.prepare("SELECT * FROM CardValuation ORDER BY id").all(), fixture.before); assert.match(original.prepare("SELECT sql FROM sqlite_master WHERE name='CardValuation'").get().sql, /近期成交/); } finally { original.close(); }
  validateDatabase(fixture.database);
});

test("restoring a valid pre-change backup converts only the staging copy and produces a valid manifest", t => {
  const fixture = legacyFixture(t), target = path.join(fixture.root, "current");
  initializeDatabase(path.join(target, "dev.db"));
  writeBackupManifest(fixture.data);
  const service = createRestoreService({ config: { getDataDir: () => target, getDbPath: () => path.join(target, "dev.db"), getBackupDir: () => path.join(fixture.root, "backups") }, backupDataFolder: () => ({ backupPath: "test-safety" }), ensureDataLayout });
  service.restoreDataFolder(fixture.data);
  verifyBackupManifest(fixture.data); verifyBackupManifest(target);
  const incoming = new DatabaseSync(path.join(target, "dev.db"));
  try { assert.equal(incoming.prepare("SELECT source FROM CardValuation WHERE id='sale'").get().source, "卡淘"); } finally { incoming.close(); }
  const original = new DatabaseSync(fixture.database);
  try { assert.deepEqual(original.prepare("SELECT * FROM CardValuation ORDER BY id").all(), fixture.before); } finally { original.close(); }
});
