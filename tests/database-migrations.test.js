const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { DatabaseSync } = require("node:sqlite");
const { initializeDatabase, migrationIds } = require("../scripts/database-migrations");

function temporaryDatabase(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "card-vault-migration-test-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return path.join(root, "dev.db");
}

function seedLegacyDatabase(dbPath) {
  const db = new DatabaseSync(dbPath);
  db.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE Card (
      id TEXT PRIMARY KEY NOT NULL,
      playerName TEXT NOT NULL,
      cardTitle TEXT NOT NULL,
      sport TEXT NOT NULL,
      team TEXT,
      year INTEGER,
      setName TEXT,
      cardNumber TEXT,
      isSerialNumbered BOOLEAN NOT NULL DEFAULT 0,
      serialNumber TEXT,
      serialRange TEXT,
      isAutograph BOOLEAN NOT NULL DEFAULT 0,
      isPatch BOOLEAN NOT NULL DEFAULT 0,
      gradingCompany TEXT,
      grade REAL,
      purchaseDate DATETIME,
      purchasePrice REAL,
      purchaseSource TEXT,
      tags TEXT,
      notes TEXT,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE CardImage (
      id TEXT PRIMARY KEY NOT NULL,
      cardId TEXT NOT NULL,
      path TEXT NOT NULL,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (cardId) REFERENCES Card(id) ON DELETE CASCADE
    );
  `);
  db.prepare(`
    INSERT INTO Card (
      id, playerName, cardTitle, sport, year, setName, grade, serialNumber, serialRange,
      purchaseDate, purchasePrice, purchaseSource
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run("legacy-card", "Legacy Player", "Legacy Card", "Basketball", 2016, "Legacy Set", 9.5, "12", "/99", "2025-01-02", 100.25, "Legacy Source");
  db.prepare("INSERT INTO CardImage (id, cardId, path) VALUES (?, ?, ?)")
    .run("legacy-image", "legacy-card", "/media/legacy.jpg");
  db.close();
}

test("ordered migrations preserve legacy cards and create a pre-migration snapshot", (t) => {
  const dbPath = temporaryDatabase(t);
  seedLegacyDatabase(dbPath);

  const result = initializeDatabase(dbPath);
  assert.deepEqual(result.appliedMigrations, migrationIds);
  assert.ok(result.backupPath);
  assert.equal(fs.existsSync(result.backupPath), true);

  const db = new DatabaseSync(dbPath, { readOnly: true });
  const card = db.prepare(`
    SELECT playerName, year, productLine, grade, visibility, collectionStatus, isSerialNumbered
    FROM Card WHERE id = ?
  `).get("legacy-card");
  const image = db.prepare("SELECT path FROM CardImage WHERE cardId = ?").get("legacy-card");
  const applied = db.prepare("SELECT id FROM SchemaMigration ORDER BY id").all().map((row) => row.id);
  const shareColumns = db.prepare("PRAGMA table_info(ShareCollection)").all().map((column) => column.name);
  const transaction = db.prepare("SELECT * FROM CardTransaction WHERE cardId = ?").get("legacy-card");
  const expenseCount = db.prepare("SELECT COUNT(*) AS count FROM CardExpense WHERE cardId = ?").get("legacy-card").count;
  const valuationCount = db.prepare("SELECT COUNT(*) AS count FROM CardValuation WHERE cardId = ?").get("legacy-card").count;
  const draftColumns = db.prepare("PRAGMA table_info(CardEntryDraft)").all().map((column) => column.name);
  const draftIndexes = db.prepare("PRAGMA index_list(CardEntryDraft)").all().map((index) => index.name);
  const queueItemColumns = db.prepare("PRAGMA table_info(CardEntryQueueItem)").all().map((column) => column.name);
  const queueImageColumns = db.prepare("PRAGMA table_info(CardEntryQueueImage)").all().map((column) => column.name);
  const queueImageIndexes = db.prepare("PRAGMA index_list(CardEntryQueueImage)").all().map((index) => index.name);
  const templateColumns = db.prepare("PRAGMA table_info(CardEntryTemplate)").all().map((column) => column.name);
  const recognitionColumns = db.prepare("PRAGMA table_info(CardEntryRecognition)").all().map((column) => column.name);
  const recognitionIndexes = db.prepare("PRAGMA index_list(CardEntryRecognition)").all().map((index) => index.name);
  db.close();

  assert.equal(card.playerName, "Legacy Player");
  assert.equal(card.year, "2016");
  assert.equal(card.productLine, "Legacy Set");
  assert.equal(card.grade, "9.5");
  assert.equal(card.visibility, "private");
  assert.equal(card.collectionStatus, "holding");
  assert.equal(card.isSerialNumbered, 1);
  assert.equal(image.path, "/media/legacy.jpg");
  assert.deepEqual(applied, migrationIds);
  assert.ok(shareColumns.includes("presentationConfig"));
  assert.equal(transaction.kind, "purchase");
  assert.equal(transaction.amountMinor, 10025);
  assert.equal(transaction.currency, "CNY");
  assert.equal(transaction.source, "Legacy Source");
  assert.equal(transaction.provenance, "legacy_card_snapshot");
  assert.equal(expenseCount, 0);
  assert.equal(valuationCount, 0);
  assert.deepEqual(draftColumns, ["id", "schemaVersion", "status", "valuesJson", "createdAt", "updatedAt"]);
  assert.ok(draftIndexes.includes("CardEntryDraft_status_updatedAt_idx"));
  assert.ok(draftIndexes.includes("CardEntryDraft_updatedAt_idx"));
  assert.deepEqual(queueItemColumns, ["id", "batchId", "status", "sortOrder", "attemptCount", "errorMessage", "createdAt", "updatedAt"]);
  assert.deepEqual(queueImageColumns, ["id", "itemId", "originalName", "sourcePath", "processedPath", "side", "sortOrder", "mimeType", "originalBytes", "processedBytes", "width", "height", "createdAt", "updatedAt"]);
  assert.ok(queueImageIndexes.includes("CardEntryQueueImage_itemId_sortOrder_idx"));
  assert.deepEqual(templateColumns, ["id", "name", "valuesJson", "useCount", "lastUsedAt", "createdAt", "updatedAt"]);
  assert.deepEqual(recognitionColumns, ["id", "itemId", "status", "suggestionJson", "confidenceJson", "attemptCount", "errorMessage", "createdAt", "updatedAt"]);
  assert.ok(recognitionIndexes.includes("CardEntryRecognition_itemId_key"));
  assert.ok(recognitionIndexes.includes("CardEntryRecognition_status_updatedAt_idx"));
});

test("serial-numbered backfill handles each evidence path exactly once", (t) => {
  const dbPath = temporaryDatabase(t);
  initializeDatabase(dbPath);
  const db = new DatabaseSync(dbPath);
  const insert = db.prepare(`
    INSERT INTO Card (id, playerName, cardTitle, sport, isSerialNumbered, serialNumber, serialRange)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  insert.run("serial-only", "Serial", "Serial only", "Basketball", 0, "12", null);
  insert.run("range-only", "Range", "Range only", "Basketball", 0, null, "/99");
  insert.run("blank-numbering", "Blank", "Blank numbering", "Basketball", 0, "  ", "");
  insert.run("explicit-limit", "Explicit", "Explicit limit", "Basketball", 1, null, null);
  db.prepare("DELETE FROM SchemaMigration WHERE id = ?").run("009_backfill_serial_numbered_v1_0_19");
  db.close();

  const firstRun = initializeDatabase(dbPath);
  assert.deepEqual(firstRun.appliedMigrations, ["009_backfill_serial_numbered_v1_0_19"]);

  const verify = new DatabaseSync(dbPath, { readOnly: true });
  const flags = Object.fromEntries(
    verify.prepare("SELECT id, isSerialNumbered FROM Card ORDER BY id").all()
      .map((row) => [row.id, row.isSerialNumbered])
  );
  verify.close();

  assert.deepEqual(flags, {
    "blank-numbering": 0,
    "explicit-limit": 1,
    "range-only": 1,
    "serial-only": 1
  });
  assert.deepEqual(initializeDatabase(dbPath).appliedMigrations, []);
});

test("financial history migration backfills exact baseline records and enforces constraints", (t) => {
  const dbPath = temporaryDatabase(t);
  initializeDatabase(dbPath);
  const db = new DatabaseSync(dbPath);
  db.prepare(`
    INSERT INTO Card (
      id, playerName, cardTitle, sport, gradingFee, currentValue, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run("history-card", "History Player", "History Card", "Basketball", 12.34, 456.78, "2025-01-01", "2025-02-01");
  db.prepare("DELETE FROM SchemaMigration WHERE id = ?").run("006_card_financial_history_v1_1_0");
  db.close();

  const rerun = initializeDatabase(dbPath);
  assert.deepEqual(rerun.appliedMigrations, ["006_card_financial_history_v1_1_0"]);

  const verify = new DatabaseSync(dbPath);
  verify.exec("PRAGMA foreign_keys = ON;");
  const expense = verify.prepare("SELECT * FROM CardExpense WHERE cardId = ?").get("history-card");
  const valuation = verify.prepare("SELECT * FROM CardValuation WHERE cardId = ?").get("history-card");
  assert.equal(expense.amountMinor, 1234);
  assert.equal(expense.kind, "grading");
  assert.equal(valuation.amountMinor, 45678);
  assert.equal(valuation.valuedAt, "2025-02-01");
  assert.equal(valuation.source, "个人估计");
  assert.throws(
    () => verify.prepare(`
      INSERT INTO CardExpense (id, cardId, kind, amountMinor, currency, occurredAt, provenance)
      VALUES ('bad-expense', 'history-card', 'grading', -1, 'CNY', CURRENT_TIMESTAMP, 'test')
    `).run(),
    /CHECK constraint failed/
  );
  verify.prepare("DELETE FROM Card WHERE id = ?").run("history-card");
  assert.equal(verify.prepare("SELECT COUNT(*) AS count FROM CardExpense WHERE cardId = ?").get("history-card").count, 0);
  assert.equal(verify.prepare("SELECT COUNT(*) AS count FROM CardValuation WHERE cardId = ?").get("history-card").count, 0);
  verify.close();
});

test("valuation source migration normalizes every existing record to personal estimate", (t) => {
  const dbPath = temporaryDatabase(t);
  initializeDatabase(dbPath);
  const db = new DatabaseSync(dbPath);
  db.prepare("DELETE FROM SchemaMigration WHERE id = ?").run("007_normalize_valuation_sources_v1_1_0");
  db.prepare("INSERT INTO Card (id, playerName, cardTitle, sport) VALUES (?, ?, ?, ?)")
    .run("source-card", "Source Player", "Source Card", "Basketball");
  db.exec("PRAGMA ignore_check_constraints = ON;");
  db.prepare(`
    INSERT INTO CardValuation (id, cardId, amountMinor, currency, valuedAt, source, provenance)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run("source-valuation", "source-card", 10000, "CNY", "2025-01-01", "旧自由文本来源", "manual");
  db.exec("PRAGMA ignore_check_constraints = OFF;");
  db.close();

  const rerun = initializeDatabase(dbPath);
  assert.deepEqual(rerun.appliedMigrations, ["007_normalize_valuation_sources_v1_1_0"]);
  const verify = new DatabaseSync(dbPath);
  const valuation = verify.prepare("SELECT source FROM CardValuation WHERE id = ?").get("source-valuation");
  assert.throws(
    () => verify.prepare(`
      INSERT INTO CardValuation (id, cardId, amountMinor, currency, valuedAt, source, provenance)
      VALUES ('invalid-source', 'source-card', 100, 'CNY', '2025-01-02', '自由文本', 'manual')
    `).run(),
    /CHECK constraint failed/
  );
  verify.close();
  assert.equal(valuation.source, "个人估计");
});

test("currency migration deletes unsupported history and rejects future currencies", (t) => {
  const dbPath = temporaryDatabase(t);
  initializeDatabase(dbPath);
  const db = new DatabaseSync(dbPath);
  db.prepare("DELETE FROM SchemaMigration WHERE id = ?").run("008_limit_financial_currencies_v1_1_0");
  db.prepare("INSERT INTO Card (id, playerName, cardTitle, sport) VALUES (?, ?, ?, ?)")
    .run("currency-card", "Currency Player", "Currency Card", "Basketball");
  db.exec("DROP TRIGGER IF EXISTS CardValuation_currency_insert_check;");
  db.prepare(`
    INSERT INTO CardValuation (id, cardId, amountMinor, currency, valuedAt, source, provenance)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run("eur-valuation", "currency-card", 10000, "EUR", "2025-01-01", "个人估计", "manual");
  db.close();

  const rerun = initializeDatabase(dbPath);
  assert.deepEqual(rerun.appliedMigrations, ["008_limit_financial_currencies_v1_1_0"]);
  const verify = new DatabaseSync(dbPath);
  assert.equal(verify.prepare("SELECT COUNT(*) AS count FROM CardValuation WHERE id = ?").get("eur-valuation").count, 0);
  assert.throws(
    () => verify.prepare(`
      INSERT INTO CardValuation (id, cardId, amountMinor, currency, valuedAt, source, provenance)
      VALUES ('gbp-valuation', 'currency-card', 100, 'GBP', '2025-01-02', '个人估计', 'manual')
    `).run(),
    /currency must be CNY or USD/
  );
  verify.close();
});

test("database initialization is idempotent after all migrations are recorded", (t) => {
  const dbPath = temporaryDatabase(t);
  const first = initializeDatabase(dbPath);
  const second = initializeDatabase(dbPath);

  assert.equal(first.backupPath, null);
  assert.deepEqual(first.appliedMigrations, migrationIds);
  assert.equal(second.backupPath, null);
  assert.deepEqual(second.appliedMigrations, []);
});
