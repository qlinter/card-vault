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
      id, playerName, cardTitle, sport, year, setName, grade, purchasePrice
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run("legacy-card", "Legacy Player", "Legacy Card", "Basketball", 2016, "Legacy Set", 9.5, 100);
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
    SELECT playerName, year, productLine, grade, visibility, collectionStatus
    FROM Card WHERE id = ?
  `).get("legacy-card");
  const image = db.prepare("SELECT path FROM CardImage WHERE cardId = ?").get("legacy-card");
  const applied = db.prepare("SELECT id FROM SchemaMigration ORDER BY id").all().map((row) => row.id);
  const shareColumns = db.prepare("PRAGMA table_info(ShareCollection)").all().map((column) => column.name);
  db.close();

  assert.equal(card.playerName, "Legacy Player");
  assert.equal(card.year, "2016");
  assert.equal(card.productLine, "Legacy Set");
  assert.equal(card.grade, "9.5");
  assert.equal(card.visibility, "private");
  assert.equal(card.collectionStatus, "holding");
  assert.equal(image.path, "/media/legacy.jpg");
  assert.deepEqual(applied, migrationIds);
  assert.ok(shareColumns.includes("presentationConfig"));
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
