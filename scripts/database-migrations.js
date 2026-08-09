const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");

const migrations = [
  { id: "001_initial_tables", run: createLatestTables },
  { id: "002_card_fields_v1_0_3", run: migrateCardFields, transaction: false },
  { id: "003_share_fields_v1_0_9", run: migrateShareFields },
  { id: "004_share_sections_v1_0_10", run: migrateShareSections },
  { id: "005_indexes_v1_0_10", run: createIndexes }
];

const cardColumns = [
  ["brand", "TEXT"],
  ["productLine", "TEXT"],
  ["subsetName", "TEXT"],
  ["parallel", "TEXT"],
  ["isRookie", "BOOLEAN NOT NULL DEFAULT 0"],
  ["autoType", "TEXT"],
  ["patchType", "TEXT"],
  ["certNumber", "TEXT"],
  ["visibility", "TEXT NOT NULL DEFAULT 'private'"],
  ["collectionStatus", "TEXT NOT NULL DEFAULT 'holding'"],
  ["publicDescription", "TEXT"],
  ["currentValue", "REAL"],
  ["gradingFee", "REAL"],
  ["totalCost", "REAL"],
  ["gradingLink", "TEXT"]
];

function sqliteStringLiteral(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function tableExists(db, tableName) {
  return Boolean(
    db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(tableName)
  );
}

function columnExists(db, tableName, columnName) {
  if (!tableExists(db, tableName)) {
    return false;
  }
  return db.prepare(`PRAGMA table_info(${tableName})`).all().some((column) => column.name === columnName);
}

function addColumnIfMissing(db, tableName, columnName, definition) {
  if (!columnExists(db, tableName, columnName)) {
    db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition};`);
  }
}

function createLatestTables(db) {
  db.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS Card (
      id TEXT PRIMARY KEY NOT NULL,
      playerName TEXT NOT NULL,
      cardTitle TEXT NOT NULL,
      sport TEXT NOT NULL,
      team TEXT,
      year TEXT,
      brand TEXT,
      productLine TEXT,
      subsetName TEXT,
      parallel TEXT,
      cardNumber TEXT,
      isSerialNumbered BOOLEAN NOT NULL DEFAULT 0,
      serialNumber TEXT,
      serialRange TEXT,
      isRookie BOOLEAN NOT NULL DEFAULT 0,
      isAutograph BOOLEAN NOT NULL DEFAULT 0,
      autoType TEXT,
      isPatch BOOLEAN NOT NULL DEFAULT 0,
      patchType TEXT,
      gradingCompany TEXT,
      grade TEXT,
      certNumber TEXT,
      gradingLink TEXT,
      visibility TEXT NOT NULL DEFAULT 'private',
      collectionStatus TEXT NOT NULL DEFAULT 'holding',
      purchaseDate DATETIME,
      purchasePrice REAL,
      gradingFee REAL,
      totalCost REAL,
      currentValue REAL,
      purchaseSource TEXT,
      tags TEXT,
      publicDescription TEXT,
      notes TEXT,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS CardImage (
      id TEXT PRIMARY KEY NOT NULL,
      cardId TEXT NOT NULL,
      path TEXT NOT NULL,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT CardImage_cardId_fkey FOREIGN KEY (cardId) REFERENCES Card (id) ON DELETE CASCADE ON UPDATE CASCADE
    );
    CREATE TABLE IF NOT EXISTS ShareCollection (
      id TEXT PRIMARY KEY NOT NULL,
      title TEXT NOT NULL,
      subtitle TEXT,
      slug TEXT NOT NULL,
      theme TEXT NOT NULL DEFAULT 'spotlight',
      presentationConfig TEXT,
      description TEXT,
      themeNarrative TEXT,
      themeHighlights TEXT,
      groupNotes TEXT,
      coverImagePath TEXT,
      backgroundImagePath TEXT,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS ShareSection (
      id TEXT PRIMARY KEY NOT NULL,
      shareCollectionId TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      layout TEXT NOT NULL DEFAULT 'editorial',
      sortOrder INTEGER NOT NULL DEFAULT 0,
      CONSTRAINT ShareSection_shareCollectionId_fkey FOREIGN KEY (shareCollectionId) REFERENCES ShareCollection (id) ON DELETE CASCADE ON UPDATE CASCADE
    );
    CREATE TABLE IF NOT EXISTS ShareCollectionItem (
      id TEXT PRIMARY KEY NOT NULL,
      shareCollectionId TEXT NOT NULL,
      cardId TEXT NOT NULL,
      sectionId TEXT,
      sortOrder INTEGER NOT NULL DEFAULT 0,
      displayTitle TEXT,
      displayDescription TEXT,
      CONSTRAINT ShareCollectionItem_shareCollectionId_fkey FOREIGN KEY (shareCollectionId) REFERENCES ShareCollection (id) ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT ShareCollectionItem_sectionId_fkey FOREIGN KEY (sectionId) REFERENCES ShareSection (id) ON DELETE SET NULL ON UPDATE CASCADE,
      CONSTRAINT ShareCollectionItem_cardId_fkey FOREIGN KEY (cardId) REFERENCES Card (id) ON DELETE CASCADE ON UPDATE CASCADE
    );
  `);
}

function selectableColumn(db, columnName, fallbackSql = "NULL") {
  return columnExists(db, "Card", columnName) ? columnName : fallbackSql;
}

function productLineSelectSql(db) {
  const hasProductLine = columnExists(db, "Card", "productLine");
  const hasSetName = columnExists(db, "Card", "setName");
  if (hasProductLine && hasSetName) {
    return "COALESCE(NULLIF(productLine, ''), NULLIF(setName, ''))";
  }
  if (hasProductLine) {
    return "productLine";
  }
  if (hasSetName) {
    return "setName";
  }
  return "NULL";
}

function cardColumnTypes(db) {
  return db.prepare("PRAGMA table_info(Card)").all().reduce((map, column) => {
    map[column.name] = String(column.type || "").toUpperCase();
    return map;
  }, {});
}

function recreateCardTable(db) {
  db.exec("PRAGMA foreign_keys = OFF;");
  try {
    db.exec("BEGIN IMMEDIATE;");
    db.exec("DROP TABLE IF EXISTS Card_new;");
    db.exec(`
      CREATE TABLE Card_new (
        id TEXT PRIMARY KEY NOT NULL,
        playerName TEXT NOT NULL,
        cardTitle TEXT NOT NULL,
        sport TEXT NOT NULL,
        team TEXT,
        year TEXT,
        brand TEXT,
        productLine TEXT,
        subsetName TEXT,
        parallel TEXT,
        cardNumber TEXT,
        isSerialNumbered BOOLEAN NOT NULL DEFAULT 0,
        serialNumber TEXT,
        serialRange TEXT,
        isRookie BOOLEAN NOT NULL DEFAULT 0,
        isAutograph BOOLEAN NOT NULL DEFAULT 0,
        autoType TEXT,
        isPatch BOOLEAN NOT NULL DEFAULT 0,
        patchType TEXT,
        gradingCompany TEXT,
        grade TEXT,
        certNumber TEXT,
        gradingLink TEXT,
        visibility TEXT NOT NULL DEFAULT 'private',
        collectionStatus TEXT NOT NULL DEFAULT 'holding',
        purchaseDate DATETIME,
        purchasePrice REAL,
        gradingFee REAL,
        totalCost REAL,
        currentValue REAL,
        purchaseSource TEXT,
        tags TEXT,
        publicDescription TEXT,
        notes TEXT,
        createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      INSERT INTO Card_new (
        id, playerName, cardTitle, sport, team, year, brand, productLine, subsetName, parallel,
        cardNumber, isSerialNumbered, serialNumber, serialRange, isRookie, isAutograph, autoType,
        isPatch, patchType, gradingCompany, grade, certNumber, gradingLink, visibility, collectionStatus,
        purchaseDate, purchasePrice, gradingFee, totalCost, currentValue, purchaseSource, tags,
        publicDescription, notes, createdAt, updatedAt
      )
      SELECT
        id, playerName, cardTitle, sport, team,
        CASE WHEN year IS NULL THEN NULL ELSE CAST(year AS TEXT) END,
        ${selectableColumn(db, "brand")}, ${productLineSelectSql(db)},
        ${selectableColumn(db, "subsetName")}, ${selectableColumn(db, "parallel")}, cardNumber,
        isSerialNumbered, serialNumber, serialRange, ${selectableColumn(db, "isRookie", "0")},
        isAutograph, ${selectableColumn(db, "autoType")}, isPatch,
        ${selectableColumn(db, "patchType")}, gradingCompany,
        CASE WHEN grade IS NULL THEN NULL ELSE CAST(grade AS TEXT) END,
        ${selectableColumn(db, "certNumber")}, ${selectableColumn(db, "gradingLink")},
        ${selectableColumn(db, "visibility", "'private'")},
        ${selectableColumn(db, "collectionStatus", "'holding'")}, purchaseDate, purchasePrice,
        ${selectableColumn(db, "gradingFee")}, ${selectableColumn(db, "totalCost")},
        ${selectableColumn(db, "currentValue")}, purchaseSource, tags,
        ${selectableColumn(db, "publicDescription")}, notes, createdAt, updatedAt
      FROM Card;
      DROP TABLE Card;
      ALTER TABLE Card_new RENAME TO Card;
      COMMIT;
    `);
  } catch (error) {
    try {
      db.exec("ROLLBACK;");
    } catch {
      // The transaction may already have ended.
    }
    throw error;
  } finally {
    db.exec("PRAGMA foreign_keys = ON;");
  }
}

function migrateCardFields(db) {
  for (const [columnName, definition] of cardColumns) {
    addColumnIfMissing(db, "Card", columnName, definition);
  }

  const types = cardColumnTypes(db);
  if (
    columnExists(db, "Card", "setName") ||
    (types.year && types.year !== "TEXT") ||
    (types.grade && types.grade !== "TEXT")
  ) {
    recreateCardTable(db);
  }
}

function migrateShareFields(db) {
  addColumnIfMissing(db, "ShareCollection", "backgroundImagePath", "TEXT");
  addColumnIfMissing(db, "ShareCollection", "theme", "TEXT NOT NULL DEFAULT 'spotlight'");
}

function migrateShareSections(db) {
  addColumnIfMissing(db, "ShareCollection", "presentationConfig", "TEXT");
  addColumnIfMissing(db, "ShareCollectionItem", "sectionId", "TEXT");
  db.exec(`
    CREATE TABLE IF NOT EXISTS ShareSection (
      id TEXT PRIMARY KEY NOT NULL,
      shareCollectionId TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      layout TEXT NOT NULL DEFAULT 'editorial',
      sortOrder INTEGER NOT NULL DEFAULT 0,
      CONSTRAINT ShareSection_shareCollectionId_fkey FOREIGN KEY (shareCollectionId) REFERENCES ShareCollection (id) ON DELETE CASCADE ON UPDATE CASCADE
    );
  `);
}

function createIndexes(db) {
  db.exec(`
    CREATE INDEX IF NOT EXISTS Card_playerName_idx ON Card(playerName);
    CREATE INDEX IF NOT EXISTS Card_cardTitle_idx ON Card(cardTitle);
    CREATE INDEX IF NOT EXISTS Card_sport_idx ON Card(sport);
    CREATE INDEX IF NOT EXISTS Card_team_idx ON Card(team);
    CREATE INDEX IF NOT EXISTS Card_year_idx ON Card(year);
    CREATE INDEX IF NOT EXISTS Card_brand_idx ON Card(brand);
    CREATE INDEX IF NOT EXISTS Card_productLine_idx ON Card(productLine);
    CREATE INDEX IF NOT EXISTS Card_parallel_idx ON Card(parallel);
    CREATE INDEX IF NOT EXISTS Card_visibility_idx ON Card(visibility);
    CREATE INDEX IF NOT EXISTS Card_collectionStatus_idx ON Card(collectionStatus);
    CREATE INDEX IF NOT EXISTS Card_createdAt_idx ON Card(createdAt DESC);
    CREATE INDEX IF NOT EXISTS CardImage_cardId_idx ON CardImage(cardId);
    CREATE UNIQUE INDEX IF NOT EXISTS ShareCollection_slug_key ON ShareCollection(slug);
    CREATE INDEX IF NOT EXISTS ShareCollection_createdAt_idx ON ShareCollection(createdAt DESC);
    CREATE INDEX IF NOT EXISTS ShareSection_shareCollectionId_idx ON ShareSection(shareCollectionId);
    CREATE INDEX IF NOT EXISTS ShareSection_sortOrder_idx ON ShareSection(sortOrder);
    CREATE UNIQUE INDEX IF NOT EXISTS ShareCollectionItem_shareCollectionId_cardId_key ON ShareCollectionItem(shareCollectionId, cardId);
    CREATE INDEX IF NOT EXISTS ShareCollectionItem_shareCollectionId_idx ON ShareCollectionItem(shareCollectionId);
    CREATE INDEX IF NOT EXISTS ShareCollectionItem_sectionId_idx ON ShareCollectionItem(sectionId);
    CREATE INDEX IF NOT EXISTS ShareCollectionItem_cardId_idx ON ShareCollectionItem(cardId);
    CREATE INDEX IF NOT EXISTS ShareCollectionItem_sortOrder_idx ON ShareCollectionItem(sortOrder);
  `);
}

function createMigrationTable(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS SchemaMigration (
      id TEXT PRIMARY KEY NOT NULL,
      appliedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

function currentMigrationIds(db) {
  return new Set(db.prepare("SELECT id FROM SchemaMigration ORDER BY id").all().map((row) => row.id));
}

function hasExistingApplicationData(db) {
  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name != 'SchemaMigration'")
    .all();
  return tables.length > 0;
}

function createPreMigrationSnapshot(db, dbPath, targetMigrationId) {
  const backupDir = path.join(path.dirname(dbPath), "schema-backups");
  fs.mkdirSync(backupDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const fileName = `${path.basename(dbPath, path.extname(dbPath))}-before-${targetMigrationId}-${stamp}.db`;
  const backupPath = path.join(backupDir, fileName);
  db.exec(`VACUUM INTO ${sqliteStringLiteral(backupPath)};`);
  return backupPath;
}

function applyMigration(db, migration) {
  if (migration.transaction === false) {
    migration.run(db);
    db.prepare("INSERT INTO SchemaMigration (id) VALUES (?)").run(migration.id);
    return;
  }

  db.exec("BEGIN IMMEDIATE;");
  try {
    migration.run(db);
    db.prepare("INSERT INTO SchemaMigration (id) VALUES (?)").run(migration.id);
    db.exec("COMMIT;");
  } catch (error) {
    db.exec("ROLLBACK;");
    throw error;
  }
}

function initializeDatabase(dbPath) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  let backupPath = null;
  try {
    db.exec("PRAGMA foreign_keys = ON;");
    const hadApplicationData = hasExistingApplicationData(db);
    createMigrationTable(db);
    const applied = currentMigrationIds(db);
    const pending = migrations.filter((migration) => !applied.has(migration.id));

    if (hadApplicationData && pending.length > 0) {
      backupPath = createPreMigrationSnapshot(db, dbPath, pending[pending.length - 1].id);
    }

    for (const migration of pending) {
      applyMigration(db, migration);
    }

    const integrity = db.prepare("PRAGMA integrity_check;").all();
    const isValid = integrity.length === 1 && Object.values(integrity[0]).some((value) => String(value).toLowerCase() === "ok");
    if (!isValid) {
      throw new Error("Database integrity check failed after migrations.");
    }

    return {
      dbPath,
      backupPath,
      appliedMigrations: pending.map((migration) => migration.id),
      schemaVersion: migrations[migrations.length - 1].id
    };
  } finally {
    db.close();
  }
}

module.exports = {
  initializeDatabase,
  migrationIds: migrations.map((migration) => migration.id)
};
