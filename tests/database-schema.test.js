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

test("current baseline initializes the complete schema without migration metadata", (t) => {
  const dbPath = temporaryDatabase(t);
  const result = initializeDatabase(dbPath);
  const db = new DatabaseSync(dbPath, { readOnly: true });
  const tables = new Set(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map((row) => row.name));
  const templateIndexes = new Set(db.prepare("PRAGMA index_list(CardEntryTemplate)").all().map((row) => row.name));
  const recognitionIndexes = new Set(db.prepare("PRAGMA index_list(CardEntryRecognition)").all().map((row) => row.name));
  db.close();

  assert.equal(result.initialized, true);
  assert.equal(result.schemaVersion, schemaVersion);
  assert.equal(tables.has("SchemaMigration"), false);
  for (const table of [
    "Card", "CardImage", "CardTransaction", "CardExpense", "CardValuation",
    "CardEntryDraft", "CardEntryTemplate", "CardEntryBatch", "CardEntryQueueItem",
    "CardEntryQueueImage", "CardEntryRecognition", "ShareCollection", "ShareSection",
    "ShareCollectionItem"
  ]) assert.equal(tables.has(table), true, `${table} should exist`);
  assert.equal(templateIndexes.has("CardEntryTemplate_name_key"), true);
  assert.equal(recognitionIndexes.has("CardEntryRecognition_itemId_key"), true);
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

  assert.throws(() => initializeDatabase(dbPath), /不是 Card Vault v1.1.0/);
  const verify = new DatabaseSync(dbPath, { readOnly: true });
  const tables = verify.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").all();
  const card = verify.prepare("SELECT playerName FROM Card WHERE id = ?").get("legacy-card");
  verify.close();
  assert.deepEqual(tables.map((row) => row.name), ["Card"]);
  assert.equal(card.playerName, "Legacy Player");
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

test("v1.1.0 data upgrades expense associations and holding quantity once", (t) => {
  const dbPath = temporaryDatabase(t);
  initializeDatabase(dbPath);
  const db = new DatabaseSync(dbPath);
  db.exec("DROP INDEX CardExpense_transactionId_idx");
  db.exec("ALTER TABLE CardExpense DROP COLUMN transactionId");
  db.exec("ALTER TABLE Card DROP COLUMN holdingQuantity");
  db.exec("ALTER TABLE CardExpense DROP COLUMN context");
  db.prepare("INSERT INTO Card (id, playerName, cardTitle, sport, purchaseDate) VALUES (?, ?, ?, ?, ?)")
    .run("card-1", "Player", "Card", "Basketball", Date.parse("2026-08-01T00:00:00.000Z"));
  db.prepare(`INSERT INTO CardTransaction (id, cardId, kind, amountMinor, currency, quantity, occurredAt, provenance)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .run("purchase-1", "card-1", "purchase", 20000, "CNY", 2, Date.parse("2026-08-01T00:00:00.000Z"), "test");
  const insertExpense = db.prepare(`INSERT INTO CardExpense
    (id, cardId, kind, amountMinor, currency, occurredAt, provenance) VALUES (?, ?, ?, ?, ?, ?, ?)`);
  insertExpense.run("shipping-buy", "card-1", "shipping", 1000, "CNY", Date.parse("2026-08-01T16:00:00.000Z"), "test");
  insertExpense.run("shipping-grade", "card-1", "shipping", 2000, "CNY", Date.parse("2026-08-02T00:00:00.000Z"), "test");
  insertExpense.run("grading-1", "card-1", "grading", 3000, "CNY", Date.parse("2026-08-03T00:00:00.000Z"), "test");
  db.close();

  const result = initializeDatabase(dbPath);
  const verify = new DatabaseSync(dbPath, { readOnly: true });
  const expenses = verify.prepare("SELECT id, context, transactionId FROM CardExpense ORDER BY id").all();
  const card = verify.prepare("SELECT holdingQuantity, purchasePrice, gradingFee, totalCost FROM Card WHERE id = ?").get("card-1");
  verify.close();

  assert.equal(result.upgraded, true);
  assert.equal(result.expenseBackfill.purchaseShippingCount, 1);
  assert.equal(result.expenseBackfill.gradingShippingCount, 1);
  assert.equal(fs.existsSync(result.backupPath), true);
  assert.deepEqual(expenses.map((row) => ({ ...row })), [
    { id: "grading-1", context: "grading", transactionId: null },
    { id: "shipping-buy", context: "purchase", transactionId: null },
    { id: "shipping-grade", context: "grading", transactionId: null }
  ]);
  assert.equal(card.holdingQuantity, 2);
  assert.equal(card.purchasePrice, 200);
  assert.equal(card.gradingFee, 30);
  assert.equal(card.totalCost, 260);

  const second = initializeDatabase(dbPath);
  assert.equal(second.upgraded, false);
  assert.equal(second.backupPath, null);
});
