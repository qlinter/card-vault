const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { DatabaseSync } = require("node:sqlite");
const { initializeDatabase, schemaVersion } = require("../scripts/database-schema");

function temporaryDatabase(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "card-vault-schema-test-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return path.join(root, "dev.db");
}

test("financial schema preserves manual FX history and initializes idempotently", (t) => {
  const dbPath = temporaryDatabase(t);
  initializeDatabase(dbPath);
  const db = new DatabaseSync(dbPath);
  try {
    db.prepare("INSERT INTO ExchangeRate (id, effectiveDate, rateMicros, source, revision) VALUES ('one', '2026-01-01', 7000000, 'manual', 1)").run();
    assert.throws(() => db.prepare("INSERT INTO ExchangeRate (id, effectiveDate, rateMicros, source, revision) VALUES ('duplicate', '2026-01-01', 7100000, 'manual', 1)").run(), /UNIQUE/);
    assert.throws(() => db.prepare("INSERT INTO ExchangeRate (id, effectiveDate, rateMicros, source, revision) VALUES ('invalid', '2026-01-02', 0, 'manual', 1)").run(), /CHECK/);
  } finally { db.close(); }
  assert.equal(initializeDatabase(dbPath).initialized, false);
  const check = new DatabaseSync(dbPath, { readOnly: true });
  try { assert.equal(check.prepare("SELECT rateMicros FROM ExchangeRate").get().rateMicros, 7000000); } finally { check.close(); }
});


test("current baseline initializes the complete schema without migration metadata", (t) => {
  const dbPath = temporaryDatabase(t);
  const result = initializeDatabase(dbPath);
  const db = new DatabaseSync(dbPath, { readOnly: true });
  const tables = new Set(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map((row) => row.name));
  const templateIndexes = new Set(db.prepare("PRAGMA index_list(CardEntryTemplate)").all().map((row) => row.name));
  const recognitionIndexes = new Set(db.prepare("PRAGMA index_list(CardEntryRecognition)").all().map((row) => row.name));
  const cardImageColumns = new Set(db.prepare("PRAGMA table_info(CardImage)").all().map((row) => row.name));
  db.close();

  assert.equal(result.initialized, true);
  assert.equal(result.schemaVersion, schemaVersion);
  assert.equal(tables.has("SchemaMigration"), false);
  for (const table of [
    "Card", "CardImage", "CardTransaction", "CardExpense", "CardValuation",
    "CardEntryDraft", "CardEntryTemplate", "CardEntryBatch", "CardEntryQueueItem",
    "CardEntryQueueImage", "CardEntryRecognition", "ShareCollection", "ShareSection",
    "ShareCollectionItem", "PortfolioSavedView", "PortfolioSnapshotRecord"
  ]) assert.equal(tables.has(table), true, `${table} should exist`);
  assert.equal(templateIndexes.has("CardEntryTemplate_name_key"), true);
  assert.equal(recognitionIndexes.has("CardEntryRecognition_itemId_key"), true);
  assert.equal(cardImageColumns.has("rotation"), true);
});



test("baseline validation is idempotent and preserves current data", (t) => {
  const dbPath = temporaryDatabase(t);
  initializeDatabase(dbPath);
  const db = new DatabaseSync(dbPath);
  db.prepare("INSERT INTO Card (id, playerName, cardTitle, sport, serialRange) VALUES (?, ?, ?, ?, ?)")
    .run("card-1", "Current Player", "Current Card", "Basketball", "/1");
  db.exec("CREATE TABLE SchemaMigration (id TEXT PRIMARY KEY NOT NULL, appliedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)");
  db.prepare("INSERT INTO SchemaMigration (id) VALUES (?)").run("012_card_entry_workbench_phase3_v1_1_0");
  db.close();

  const result = initializeDatabase(dbPath);
  const verify = new DatabaseSync(dbPath, { readOnly: true });
  const card = verify.prepare("SELECT playerName, serialRange FROM Card WHERE id = ?").get("card-1");
  const migrationCount = verify.prepare("SELECT COUNT(*) AS count FROM SchemaMigration").get().count;
  verify.close();

  assert.equal(result.initialized, false);
  assert.equal(card.playerName, "Current Player");
  assert.equal(card.serialRange, "/1");
  assert.equal(migrationCount, 1);
});

test("unsupported legacy schemas are rejected without structural mutation", (t) => {
  const dbPath = temporaryDatabase(t);
  const db = new DatabaseSync(dbPath);
  db.exec("CREATE TABLE Card (id TEXT PRIMARY KEY NOT NULL, playerName TEXT NOT NULL, cardTitle TEXT NOT NULL, sport TEXT NOT NULL)");
  db.prepare("INSERT INTO Card (id, playerName, cardTitle, sport) VALUES (?, ?, ?, ?)")
    .run("legacy-card", "Legacy Player", "Legacy Card", "Basketball");
  db.close();

  assert.throws(() => initializeDatabase(dbPath), /仅支持当前完整格式/);
  const verify = new DatabaseSync(dbPath, { readOnly: true });
  const tables = verify.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").all();
  const card = verify.prepare("SELECT playerName FROM Card WHERE id = ?").get("legacy-card");
  verify.close();
  assert.deepEqual(tables.map((row) => row.name), ["Card"]);
  assert.equal(card.playerName, "Legacy Player");
});

for (const [label, change] of [
  ["pre-position expenses", "DROP INDEX CardExpense_transactionId_idx; ALTER TABLE CardExpense DROP COLUMN transactionId; ALTER TABLE CardExpense DROP COLUMN context;"],
  ["pre-rotation images", "ALTER TABLE CardImage DROP COLUMN rotation;"],
  ["pre-payment facts", "ALTER TABLE CardTransaction DROP COLUMN amountKnown;"],
  ["missing management table", "DROP TABLE CollectionPlan;"],
  ["missing tracking table", "DROP TABLE CardTracking;"],
  ["missing tracking trigger", "DROP TRIGGER tracking_status_update;"],
  ["missing current index", "DROP INDEX CardReport_valueMinor_cardId_idx;"],
  ["missing revision state", "DELETE FROM DataRevision;"],
  ["missing card tracking", "DELETE FROM CardTracking;"],
]) {
  test(`incomplete format is rejected without writes: ${label}`, t => {
    const dbPath = temporaryDatabase(t);
    initializeDatabase(dbPath);
    const db = new DatabaseSync(dbPath);
    db.exec("INSERT INTO Card(id,playerName,cardTitle,sport) VALUES('kept','A','B','Basketball');");
    db.exec(change);
    db.close();
    const before = fs.readFileSync(dbPath);
    assert.throws(() => initializeDatabase(dbPath), /当前.*格式/);
    assert.deepEqual(fs.readFileSync(dbPath), before);
    assert.equal(fs.existsSync(path.join(path.dirname(dbPath), "schema-backups")), false);
  });
}

test("current database validation preserves every byte and current zero-price facts", t => {
  const dbPath = temporaryDatabase(t);
  initializeDatabase(dbPath);
  const db = new DatabaseSync(dbPath);
  db.exec("INSERT INTO Card(id,playerName,cardTitle,sport) VALUES('free','A','B','Basketball'); INSERT INTO CardTransaction(id,cardId,kind,amountMinor,currency,occurredAt,provenance,amountKnown) VALUES('free-purchase','free','purchase',0,'CNY','2026-09-08','manual',1);");
  db.close();
  const before = fs.readFileSync(dbPath);
  assert.equal(initializeDatabase(dbPath).initialized, false);
  assert.deepEqual(fs.readFileSync(dbPath), before);
});

test("current baseline enforces financial constraints and cascade deletion", (t) => {
  const dbPath = temporaryDatabase(t);
  initializeDatabase(dbPath);
  const db = new DatabaseSync(dbPath);
  db.exec("PRAGMA foreign_keys = ON");
  db.prepare("INSERT INTO Card (id, playerName, cardTitle, sport) VALUES (?, ?, ?, ?)")
    .run("card-1", "Player", "Card", "Basketball");
  db.prepare(`INSERT INTO CardValuation (id, cardId, amountMinor, currency, valuedAt, source, provenance)
    VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .run("valuation-1", "card-1", 10000, "CNY", "2026-08-24", "个人估计", "manual");
  assert.throws(() => db.prepare(`INSERT INTO CardTransaction (id, cardId, kind, amountMinor, currency, quantity, occurredAt, provenance)
    VALUES ('refund-1', 'card-1', 'refund', 100, 'CNY', 1, CURRENT_TIMESTAMP, 'test')`).run(), /CHECK constraint failed/);
  assert.throws(() => db.prepare(`INSERT INTO CardExpense (id, cardId, kind, amountMinor, currency, occurredAt, provenance)
    VALUES ('bad-expense', 'card-1', 'grading', -1, 'CNY', CURRENT_TIMESTAMP, 'test')`).run(), /CHECK constraint failed/);
  assert.throws(() => db.prepare(`INSERT INTO CardValuation (id, cardId, amountMinor, currency, valuedAt, source, provenance)
    VALUES ('bad-currency', 'card-1', 100, 'GBP', CURRENT_TIMESTAMP, '个人估计', 'test')`).run(), /currency must be CNY or USD/);
  db.prepare("DELETE FROM Card WHERE id = ?").run("card-1");
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM CardValuation").get().count, 0);
  db.close();
});

test("portfolio snapshots survive saved-view deletion and keep their historical payload", (t) => {
  const dbPath = temporaryDatabase(t);
  initializeDatabase(dbPath);
  const db = new DatabaseSync(dbPath);
  db.exec("PRAGMA foreign_keys = ON");
  db.prepare("INSERT INTO PortfolioSavedView (id, name, queryJson) VALUES (?, ?, ?)")
    .run("view-1", "Basketball", JSON.stringify({ sport: "Basketball" }));
  db.prepare(`INSERT INTO PortfolioSnapshotRecord (id, savedViewId, name, queryJson, snapshotJson)
    VALUES (?, ?, ?, ?, ?)`)
    .run("snapshot-1", "view-1", "August", JSON.stringify({ sport: "Basketball" }), JSON.stringify({ cardCount: 1 }));
  db.prepare("DELETE FROM PortfolioSavedView WHERE id = ?").run("view-1");
  const snapshot = db.prepare("SELECT savedViewId, snapshotJson FROM PortfolioSnapshotRecord WHERE id = ?").get("snapshot-1");
  db.close();

  assert.equal(snapshot.savedViewId, null);
  assert.deepEqual(JSON.parse(snapshot.snapshotJson), { cardCount: 1 });
});
