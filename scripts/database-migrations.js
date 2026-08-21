const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");

const migrations = [
  { id: "001_initial_tables", run: createLatestTables },
  { id: "002_card_fields_v1_0_3", run: migrateCardFields, transaction: false },
  { id: "003_share_fields_v1_0_9", run: migrateShareFields },
  { id: "004_share_sections_v1_0_10", run: migrateShareSections },
  { id: "005_indexes_v1_0_10", run: createIndexes },
  { id: "006_card_financial_history_v1_1_0", run: migrateCardFinancialHistory },
  { id: "007_normalize_valuation_sources_v1_1_0", run: normalizeValuationSources },
  { id: "008_limit_financial_currencies_v1_1_0", run: limitFinancialCurrencies },
  { id: "009_backfill_serial_numbered_v1_0_19", run: backfillSerialNumbered },
  { id: "010_card_entry_drafts_v1_1_0", run: createCardEntryDrafts },
  { id: "011_card_entry_image_queue_v1_1_0", run: createCardEntryImageQueue },
  { id: "012_card_entry_workbench_phase3_v1_1_0", run: createCardEntryWorkbenchPhase3 }
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
    CREATE TABLE IF NOT EXISTS CardEntryDraft (
      id TEXT PRIMARY KEY NOT NULL,
      schemaVersion INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'draft',
      valuesJson TEXT NOT NULL,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    ${cardEntryImageQueueTablesSql()}
    ${cardEntryWorkbenchPhase3TablesSql()}
    ${financialHistoryTablesSql()}
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

function financialHistoryTablesSql() {
  return `
    CREATE TABLE IF NOT EXISTS CardTransaction (
      id TEXT PRIMARY KEY NOT NULL,
      cardId TEXT NOT NULL,
      kind TEXT NOT NULL CHECK (kind IN ('purchase', 'sale', 'refund')),
      amountMinor INTEGER NOT NULL CHECK (typeof(amountMinor) = 'integer' AND amountMinor >= 0),
      currency TEXT NOT NULL DEFAULT 'CNY' CHECK (length(currency) = 3 AND currency = upper(currency)),
      quantity INTEGER NOT NULL DEFAULT 1 CHECK (typeof(quantity) = 'integer' AND quantity > 0),
      occurredAt DATETIME NOT NULL,
      source TEXT,
      notes TEXT,
      provenance TEXT NOT NULL CHECK (length(trim(provenance)) > 0),
      externalKey TEXT,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT CardTransaction_cardId_fkey FOREIGN KEY (cardId) REFERENCES Card (id) ON DELETE CASCADE ON UPDATE CASCADE
    );
    CREATE TABLE IF NOT EXISTS CardExpense (
      id TEXT PRIMARY KEY NOT NULL,
      cardId TEXT NOT NULL,
      kind TEXT NOT NULL CHECK (kind IN ('grading', 'shipping', 'tax', 'insurance', 'storage', 'marketplace_fee', 'other')),
      amountMinor INTEGER NOT NULL CHECK (typeof(amountMinor) = 'integer' AND amountMinor >= 0),
      currency TEXT NOT NULL DEFAULT 'CNY' CHECK (length(currency) = 3 AND currency = upper(currency)),
      occurredAt DATETIME NOT NULL,
      vendor TEXT,
      notes TEXT,
      provenance TEXT NOT NULL CHECK (length(trim(provenance)) > 0),
      externalKey TEXT,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT CardExpense_cardId_fkey FOREIGN KEY (cardId) REFERENCES Card (id) ON DELETE CASCADE ON UPDATE CASCADE
    );
    CREATE TABLE IF NOT EXISTS CardValuation (
      id TEXT PRIMARY KEY NOT NULL,
      cardId TEXT NOT NULL,
      amountMinor INTEGER NOT NULL CHECK (typeof(amountMinor) = 'integer' AND amountMinor >= 0),
      currency TEXT NOT NULL DEFAULT 'CNY' CHECK (length(currency) = 3 AND currency = upper(currency)),
      valuedAt DATETIME NOT NULL,
      source TEXT NOT NULL DEFAULT '个人估计' CHECK (source IN ('个人估计', '近期成交', '平台报价')),
      notes TEXT,
      provenance TEXT NOT NULL CHECK (length(trim(provenance)) > 0),
      externalKey TEXT,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT CardValuation_cardId_fkey FOREIGN KEY (cardId) REFERENCES Card (id) ON DELETE CASCADE ON UPDATE CASCADE
    );
  `;
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

function legacyMoneyToMinor(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }
  return Math.round((parsed + Number.EPSILON) * 100);
}

function legacyHistoryTimestamp(card) {
  return card.purchaseDate || card.updatedAt || card.createdAt || new Date(0).toISOString();
}

function migrateCardFinancialHistory(db) {
  db.exec(financialHistoryTablesSql());
  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS CardTransaction_externalKey_key ON CardTransaction(externalKey);
    CREATE UNIQUE INDEX IF NOT EXISTS CardExpense_externalKey_key ON CardExpense(externalKey);
    CREATE UNIQUE INDEX IF NOT EXISTS CardValuation_externalKey_key ON CardValuation(externalKey);
    CREATE INDEX IF NOT EXISTS CardTransaction_cardId_occurredAt_idx ON CardTransaction(cardId, occurredAt DESC);
    CREATE INDEX IF NOT EXISTS CardTransaction_kind_idx ON CardTransaction(kind);
    CREATE INDEX IF NOT EXISTS CardTransaction_occurredAt_idx ON CardTransaction(occurredAt DESC);
    CREATE INDEX IF NOT EXISTS CardExpense_cardId_occurredAt_idx ON CardExpense(cardId, occurredAt DESC);
    CREATE INDEX IF NOT EXISTS CardExpense_kind_idx ON CardExpense(kind);
    CREATE INDEX IF NOT EXISTS CardExpense_occurredAt_idx ON CardExpense(occurredAt DESC);
    CREATE INDEX IF NOT EXISTS CardValuation_cardId_valuedAt_idx ON CardValuation(cardId, valuedAt DESC);
    CREATE INDEX IF NOT EXISTS CardValuation_valuedAt_idx ON CardValuation(valuedAt DESC);
  `);

  const cards = db.prepare(`
    SELECT id, purchaseDate, purchasePrice, gradingFee, currentValue, purchaseSource, createdAt, updatedAt
    FROM Card
  `).all();
  const insertTransaction = db.prepare(`
    INSERT OR IGNORE INTO CardTransaction (
      id, cardId, kind, amountMinor, currency, quantity, occurredAt, source, provenance, externalKey
    ) VALUES (?, ?, 'purchase', ?, 'CNY', 1, ?, ?, 'legacy_card_snapshot', ?)
  `);
  const insertExpense = db.prepare(`
    INSERT OR IGNORE INTO CardExpense (
      id, cardId, kind, amountMinor, currency, occurredAt, vendor, provenance, externalKey
    ) VALUES (?, ?, 'grading', ?, 'CNY', ?, NULL, 'legacy_card_snapshot', ?)
  `);
  const insertValuation = db.prepare(`
    INSERT OR IGNORE INTO CardValuation (
      id, cardId, amountMinor, currency, valuedAt, source, provenance, externalKey
    ) VALUES (?, ?, ?, 'CNY', ?, '个人估计', 'legacy_card_snapshot', ?)
  `);

  for (const card of cards) {
    const timestamp = legacyHistoryTimestamp(card);
    const purchaseMinor = legacyMoneyToMinor(card.purchasePrice);
    const gradingMinor = legacyMoneyToMinor(card.gradingFee);
    const valuationMinor = legacyMoneyToMinor(card.currentValue);
    if (purchaseMinor !== null) {
      insertTransaction.run(
        `legacy-purchase-${card.id}`,
        card.id,
        purchaseMinor,
        timestamp,
        card.purchaseSource || null,
        `legacy:purchase:${card.id}`
      );
    }
    if (gradingMinor !== null) {
      insertExpense.run(
        `legacy-grading-${card.id}`,
        card.id,
        gradingMinor,
        timestamp,
        `legacy:grading:${card.id}`
      );
    }
    if (valuationMinor !== null) {
      insertValuation.run(
        `legacy-valuation-${card.id}`,
        card.id,
        valuationMinor,
        card.updatedAt || timestamp,
        `legacy:valuation:${card.id}`
      );
    }
  }
}

function normalizeValuationSources(db) {
  if (!tableExists(db, "CardValuation")) return;
  db.exec(`
    DROP TABLE IF EXISTS CardValuation_normalized;
    CREATE TABLE CardValuation_normalized (
      id TEXT PRIMARY KEY NOT NULL,
      cardId TEXT NOT NULL,
      amountMinor INTEGER NOT NULL CHECK (typeof(amountMinor) = 'integer' AND amountMinor >= 0),
      currency TEXT NOT NULL DEFAULT 'CNY' CHECK (length(currency) = 3 AND currency = upper(currency)),
      valuedAt DATETIME NOT NULL,
      source TEXT NOT NULL DEFAULT '个人估计' CHECK (source IN ('个人估计', '近期成交', '平台报价')),
      notes TEXT,
      provenance TEXT NOT NULL CHECK (length(trim(provenance)) > 0),
      externalKey TEXT,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT CardValuation_cardId_fkey FOREIGN KEY (cardId) REFERENCES Card (id) ON DELETE CASCADE ON UPDATE CASCADE
    );
    INSERT INTO CardValuation_normalized (
      id, cardId, amountMinor, currency, valuedAt, source, notes, provenance, externalKey, createdAt, updatedAt
    )
    SELECT
      id, cardId, amountMinor, currency, valuedAt, '个人估计', notes, provenance, externalKey, createdAt, updatedAt
    FROM CardValuation;
    DROP TABLE CardValuation;
    ALTER TABLE CardValuation_normalized RENAME TO CardValuation;
    CREATE UNIQUE INDEX CardValuation_externalKey_key ON CardValuation(externalKey);
    CREATE INDEX CardValuation_cardId_valuedAt_idx ON CardValuation(cardId, valuedAt DESC);
    CREATE INDEX CardValuation_valuedAt_idx ON CardValuation(valuedAt DESC);
  `);
}

function limitFinancialCurrencies(db) {
  const tableNames = ["CardTransaction", "CardExpense", "CardValuation"];
  for (const tableName of tableNames) {
    if (tableExists(db, tableName)) {
      db.exec(`DELETE FROM ${tableName} WHERE currency NOT IN ('CNY', 'USD');`);
    }
  }
  for (const tableName of tableNames) {
    for (const operation of ["INSERT", "UPDATE OF currency"]) {
      const suffix = operation === "INSERT" ? "insert" : "update";
      db.exec(`
        CREATE TRIGGER IF NOT EXISTS ${tableName}_currency_${suffix}_check
        BEFORE ${operation} ON ${tableName} WHEN NEW.currency NOT IN ('CNY', 'USD')
        BEGIN SELECT RAISE(ABORT, 'currency must be CNY or USD'); END;
      `);
    }
  }
}

function backfillSerialNumbered(db) {
  db.exec(`
    UPDATE Card
    SET isSerialNumbered = 1
    WHERE isSerialNumbered = 0
      AND (
        (serialNumber IS NOT NULL AND TRIM(serialNumber) <> '')
        OR (serialRange IS NOT NULL AND TRIM(serialRange) <> '')
      );
  `);
}

function createCardEntryDrafts(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS CardEntryDraft (
      id TEXT PRIMARY KEY NOT NULL,
      schemaVersion INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'draft',
      valuesJson TEXT NOT NULL,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS CardEntryDraft_status_updatedAt_idx
      ON CardEntryDraft(status, updatedAt DESC);
    CREATE INDEX IF NOT EXISTS CardEntryDraft_updatedAt_idx
      ON CardEntryDraft(updatedAt DESC);
  `);
}

function cardEntryImageQueueTablesSql() {
  return `
    CREATE TABLE IF NOT EXISTS CardEntryBatch (
      id TEXT PRIMARY KEY NOT NULL,
      label TEXT,
      pairingMode TEXT NOT NULL DEFAULT 'pairs',
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS CardEntryQueueItem (
      id TEXT PRIMARY KEY NOT NULL,
      batchId TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'processing',
      sortOrder INTEGER NOT NULL DEFAULT 0,
      attemptCount INTEGER NOT NULL DEFAULT 0,
      errorMessage TEXT,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT CardEntryQueueItem_batchId_fkey FOREIGN KEY (batchId) REFERENCES CardEntryBatch (id) ON DELETE CASCADE ON UPDATE CASCADE
    );
    CREATE TABLE IF NOT EXISTS CardEntryQueueImage (
      id TEXT PRIMARY KEY NOT NULL,
      itemId TEXT NOT NULL,
      originalName TEXT NOT NULL,
      sourcePath TEXT,
      processedPath TEXT,
      side TEXT NOT NULL DEFAULT 'front',
      sortOrder INTEGER NOT NULL DEFAULT 0,
      mimeType TEXT NOT NULL,
      originalBytes INTEGER NOT NULL,
      processedBytes INTEGER,
      width INTEGER,
      height INTEGER,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT CardEntryQueueImage_itemId_fkey FOREIGN KEY (itemId) REFERENCES CardEntryQueueItem (id) ON DELETE CASCADE ON UPDATE CASCADE
    );
  `;
}

function createCardEntryImageQueue(db) {
  db.exec(cardEntryImageQueueTablesSql());
  db.exec(`
    CREATE INDEX IF NOT EXISTS CardEntryBatch_createdAt_idx
      ON CardEntryBatch(createdAt DESC);
    CREATE INDEX IF NOT EXISTS CardEntryQueueItem_batchId_sortOrder_idx
      ON CardEntryQueueItem(batchId, sortOrder);
    CREATE INDEX IF NOT EXISTS CardEntryQueueItem_status_createdAt_idx
      ON CardEntryQueueItem(status, createdAt);
    CREATE INDEX IF NOT EXISTS CardEntryQueueImage_itemId_sortOrder_idx
      ON CardEntryQueueImage(itemId, sortOrder);
  `);
}

function cardEntryWorkbenchPhase3TablesSql() {
  return `
    CREATE TABLE IF NOT EXISTS CardEntryTemplate (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      valuesJson TEXT NOT NULL,
      useCount INTEGER NOT NULL DEFAULT 0,
      lastUsedAt DATETIME,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS CardEntryRecognition (
      id TEXT PRIMARY KEY NOT NULL,
      itemId TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'recognizing',
      suggestionJson TEXT,
      confidenceJson TEXT,
      attemptCount INTEGER NOT NULL DEFAULT 0,
      errorMessage TEXT,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT CardEntryRecognition_itemId_fkey FOREIGN KEY (itemId) REFERENCES CardEntryQueueItem (id) ON DELETE CASCADE ON UPDATE CASCADE
    );
  `;
}

function createCardEntryWorkbenchPhase3(db) {
  db.exec(cardEntryWorkbenchPhase3TablesSql());
  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS CardEntryTemplate_name_key
      ON CardEntryTemplate(name);
    CREATE INDEX IF NOT EXISTS CardEntryTemplate_lastUsedAt_idx
      ON CardEntryTemplate(lastUsedAt DESC);
    CREATE INDEX IF NOT EXISTS CardEntryTemplate_updatedAt_idx
      ON CardEntryTemplate(updatedAt DESC);
    CREATE UNIQUE INDEX IF NOT EXISTS CardEntryRecognition_itemId_key
      ON CardEntryRecognition(itemId);
    CREATE INDEX IF NOT EXISTS CardEntryRecognition_status_updatedAt_idx
      ON CardEntryRecognition(status, updatedAt);
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
