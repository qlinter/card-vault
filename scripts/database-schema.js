const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const { createManagementSchema, managementSchemaNeeded } = require("./management-schema");

const schemaVersion = "1.3.0";
const previousSchemaVersion = "1.1.1";
const v120RequiredSchema = {
  Card: [
    "id", "playerName", "cardTitle", "sport", "team", "year", "brand", "productLine", "subsetName",
    "parallel", "cardNumber", "isSerialNumbered", "serialNumber", "serialRange", "isRookie",
    "isAutograph", "autoType", "isPatch", "patchType", "gradingCompany", "grade", "certNumber",
    "gradingLink", "visibility", "collectionStatus", "holdingQuantity", "purchaseDate", "purchasePrice", "gradingFee",
    "totalCost", "currentValue", "purchaseSource", "tags", "publicDescription", "notes", "createdAt", "updatedAt"
  ],
  CardImage: ["id", "cardId", "path", "rotation", "createdAt"],
  CardTransaction: ["id", "cardId", "kind", "amountMinor", "currency", "quantity", "occurredAt", "source", "notes", "provenance", "externalKey", "createdAt", "updatedAt"],
  CardExpense: ["id", "cardId", "kind", "context", "transactionId", "amountMinor", "currency", "occurredAt", "vendor", "notes", "provenance", "externalKey", "createdAt", "updatedAt"],
  CardValuation: ["id", "cardId", "amountMinor", "currency", "valuedAt", "source", "notes", "provenance", "externalKey", "createdAt", "updatedAt"],
  CardEntryDraft: ["id", "schemaVersion", "status", "valuesJson", "createdAt", "updatedAt"],
  CardEntryTemplate: ["id", "name", "valuesJson", "useCount", "lastUsedAt", "createdAt", "updatedAt"],
  CardEntryBatch: ["id", "label", "pairingMode", "createdAt", "updatedAt"],
  CardEntryQueueItem: ["id", "batchId", "status", "sortOrder", "attemptCount", "errorMessage", "createdAt", "updatedAt"],
  CardEntryQueueImage: ["id", "itemId", "originalName", "sourcePath", "processedPath", "side", "sortOrder", "mimeType", "originalBytes", "processedBytes", "width", "height", "createdAt", "updatedAt"],
  CardEntryRecognition: ["id", "itemId", "status", "suggestionJson", "confidenceJson", "attemptCount", "errorMessage", "createdAt", "updatedAt"],
  ShareCollection: ["id", "title", "subtitle", "slug", "theme", "presentationConfig", "description", "themeNarrative", "themeHighlights", "groupNotes", "coverImagePath", "backgroundImagePath", "createdAt", "updatedAt"],
  ShareSection: ["id", "shareCollectionId", "title", "description", "layout", "sortOrder"],
  ShareCollectionItem: ["id", "shareCollectionId", "cardId", "sectionId", "sortOrder", "displayTitle", "displayDescription"],
  PortfolioSavedView: ["id", "name", "queryJson", "createdAt", "updatedAt"],
  PortfolioSnapshotRecord: ["id", "savedViewId", "name", "queryJson", "snapshotJson", "capturedAt"]
};

const requiredSchema = {
  ...v120RequiredSchema,
  CardTransaction: [...v120RequiredSchema.CardTransaction, "paymentsJson", "amountKnown"],
  FinancialSettings: ["id", "reportingCurrency"],
  ExchangeRate: ["id", "effectiveDate", "rateMicros", "source", "revision", "createdAt"]
};
const portfolioTableNames = new Set(["PortfolioSavedView", "PortfolioSnapshotRecord"]);
const prePortfolioRequiredSchema = Object.fromEntries(
  Object.entries(v120RequiredSchema).filter(([tableName]) => !portfolioTableNames.has(tableName))
);
const preRotationRequiredSchema = {
  ...v120RequiredSchema,
  CardImage: v120RequiredSchema.CardImage.filter((column) => column !== "rotation")
};
const prePortfolioPreRotationRequiredSchema = Object.fromEntries(
  Object.entries(preRotationRequiredSchema).filter(([tableName]) => !portfolioTableNames.has(tableName))
);
const v110RequiredSchema = {
  ...prePortfolioPreRotationRequiredSchema,
  Card: prePortfolioPreRotationRequiredSchema.Card.filter((column) => column !== "holdingQuantity"),
  CardExpense: prePortfolioPreRotationRequiredSchema.CardExpense.filter((column) => !["context", "transactionId"].includes(column))
};

function applicationTableNames(db) {
  return db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
    .all().map((row) => row.name);
}

function schemaIssues(db, expectedSchema) {
  const existingTables = new Set(applicationTableNames(db));
  const issues = [];
  for (const [tableName, requiredColumns] of Object.entries(expectedSchema)) {
    if (!existingTables.has(tableName)) {
      issues.push(`缺少数据表 ${tableName}`);
      continue;
    }
    const columns = new Set(db.prepare(`PRAGMA table_info(${tableName})`).all().map((column) => column.name));
    for (const columnName of requiredColumns) {
      if (!columns.has(columnName)) issues.push(`数据表 ${tableName} 缺少字段 ${columnName}`);
    }
  }
  return issues;
}

function validateCurrentSchema(db) {
  const issues = schemaIssues(db, requiredSchema);
  if (issues.length > 0) {
    throw new Error(`数据库未通过 Card Vault ${schemaVersion} 当前结构校验：${issues.join("；")}。请使用已完成升级的数据或当前版本备份。`);
  }
}

function createCurrentSchema(db) {
  db.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS Card (
      id TEXT PRIMARY KEY NOT NULL, playerName TEXT NOT NULL, cardTitle TEXT NOT NULL, sport TEXT NOT NULL,
      team TEXT, year TEXT, brand TEXT, productLine TEXT, subsetName TEXT, parallel TEXT, cardNumber TEXT,
      isSerialNumbered BOOLEAN NOT NULL DEFAULT 0, serialNumber TEXT, serialRange TEXT,
      isRookie BOOLEAN NOT NULL DEFAULT 0, isAutograph BOOLEAN NOT NULL DEFAULT 0, autoType TEXT,
      isPatch BOOLEAN NOT NULL DEFAULT 0, patchType TEXT, gradingCompany TEXT, grade TEXT, certNumber TEXT,
      gradingLink TEXT, visibility TEXT NOT NULL DEFAULT 'private', collectionStatus TEXT NOT NULL DEFAULT 'holding',
      holdingQuantity INTEGER NOT NULL DEFAULT 1 CHECK (typeof(holdingQuantity) = 'integer' AND holdingQuantity >= 0),
      purchaseDate DATETIME, purchasePrice REAL, gradingFee REAL, totalCost REAL, currentValue REAL,
      purchaseSource TEXT, tags TEXT, publicDescription TEXT, notes TEXT,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS CardImage (
      id TEXT PRIMARY KEY NOT NULL, cardId TEXT NOT NULL, path TEXT NOT NULL,
      rotation INTEGER NOT NULL DEFAULT 0 CHECK (rotation IN (0, 90, 180, 270)),
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT CardImage_cardId_fkey FOREIGN KEY (cardId) REFERENCES Card (id) ON DELETE CASCADE ON UPDATE CASCADE
    );
    CREATE TABLE IF NOT EXISTS CardTransaction (
      id TEXT PRIMARY KEY NOT NULL, cardId TEXT NOT NULL,
      kind TEXT NOT NULL CHECK (kind IN ('purchase', 'sale')),
      amountMinor INTEGER NOT NULL CHECK (typeof(amountMinor) = 'integer' AND amountMinor >= 0),
      currency TEXT NOT NULL DEFAULT 'CNY' CHECK (length(currency) = 3 AND currency = upper(currency)),
      quantity INTEGER NOT NULL DEFAULT 1 CHECK (typeof(quantity) = 'integer' AND quantity > 0),
      occurredAt DATETIME NOT NULL, source TEXT, notes TEXT,
      provenance TEXT NOT NULL CHECK (length(trim(provenance)) > 0), externalKey TEXT,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT CardTransaction_cardId_fkey FOREIGN KEY (cardId) REFERENCES Card (id) ON DELETE CASCADE ON UPDATE CASCADE
    );
    CREATE TABLE IF NOT EXISTS CardExpense (
      id TEXT PRIMARY KEY NOT NULL, cardId TEXT NOT NULL,
      kind TEXT NOT NULL CHECK (kind IN ('grading', 'shipping', 'tax', 'insurance', 'storage', 'marketplace_fee', 'other')),
      context TEXT NOT NULL DEFAULT 'grading' CHECK (context IN ('purchase', 'grading', 'sale')),
      transactionId TEXT,
      amountMinor INTEGER NOT NULL CHECK (typeof(amountMinor) = 'integer' AND amountMinor >= 0),
      currency TEXT NOT NULL DEFAULT 'CNY' CHECK (length(currency) = 3 AND currency = upper(currency)),
      occurredAt DATETIME NOT NULL, vendor TEXT, notes TEXT,
      provenance TEXT NOT NULL CHECK (length(trim(provenance)) > 0), externalKey TEXT,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT CardExpense_cardId_fkey FOREIGN KEY (cardId) REFERENCES Card (id) ON DELETE CASCADE ON UPDATE CASCADE
    );
    CREATE TABLE IF NOT EXISTS CardValuation (
      id TEXT PRIMARY KEY NOT NULL, cardId TEXT NOT NULL,
      amountMinor INTEGER NOT NULL CHECK (typeof(amountMinor) = 'integer' AND amountMinor >= 0),
      currency TEXT NOT NULL DEFAULT 'CNY' CHECK (length(currency) = 3 AND currency = upper(currency)),
      valuedAt DATETIME NOT NULL,
      source TEXT NOT NULL DEFAULT '个人估计' CHECK (source IN ('个人估计', '近期成交', '平台报价')),
      notes TEXT, provenance TEXT NOT NULL CHECK (length(trim(provenance)) > 0), externalKey TEXT,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT CardValuation_cardId_fkey FOREIGN KEY (cardId) REFERENCES Card (id) ON DELETE CASCADE ON UPDATE CASCADE
    );
    CREATE TABLE IF NOT EXISTS CardEntryDraft (
      id TEXT PRIMARY KEY NOT NULL, schemaVersion INTEGER NOT NULL DEFAULT 1, status TEXT NOT NULL DEFAULT 'draft',
      valuesJson TEXT NOT NULL, createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS CardEntryTemplate (
      id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, valuesJson TEXT NOT NULL, useCount INTEGER NOT NULL DEFAULT 0,
      lastUsedAt DATETIME, createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS CardEntryBatch (
      id TEXT PRIMARY KEY NOT NULL, label TEXT, pairingMode TEXT NOT NULL DEFAULT 'pairs',
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS CardEntryQueueItem (
      id TEXT PRIMARY KEY NOT NULL, batchId TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'processing',
      sortOrder INTEGER NOT NULL DEFAULT 0, attemptCount INTEGER NOT NULL DEFAULT 0, errorMessage TEXT,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT CardEntryQueueItem_batchId_fkey FOREIGN KEY (batchId) REFERENCES CardEntryBatch (id) ON DELETE CASCADE ON UPDATE CASCADE
    );
    CREATE TABLE IF NOT EXISTS CardEntryQueueImage (
      id TEXT PRIMARY KEY NOT NULL, itemId TEXT NOT NULL, originalName TEXT NOT NULL, sourcePath TEXT,
      processedPath TEXT, side TEXT NOT NULL DEFAULT 'front', sortOrder INTEGER NOT NULL DEFAULT 0,
      mimeType TEXT NOT NULL, originalBytes INTEGER NOT NULL, processedBytes INTEGER, width INTEGER, height INTEGER,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT CardEntryQueueImage_itemId_fkey FOREIGN KEY (itemId) REFERENCES CardEntryQueueItem (id) ON DELETE CASCADE ON UPDATE CASCADE
    );
    CREATE TABLE IF NOT EXISTS CardEntryRecognition (
      id TEXT PRIMARY KEY NOT NULL, itemId TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'recognizing',
      suggestionJson TEXT, confidenceJson TEXT, attemptCount INTEGER NOT NULL DEFAULT 0, errorMessage TEXT,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT CardEntryRecognition_itemId_fkey FOREIGN KEY (itemId) REFERENCES CardEntryQueueItem (id) ON DELETE CASCADE ON UPDATE CASCADE
    );
    CREATE TABLE IF NOT EXISTS ShareCollection (
      id TEXT PRIMARY KEY NOT NULL, title TEXT NOT NULL, subtitle TEXT, slug TEXT NOT NULL,
      theme TEXT NOT NULL DEFAULT 'spotlight', presentationConfig TEXT, description TEXT, themeNarrative TEXT,
      themeHighlights TEXT, groupNotes TEXT, coverImagePath TEXT, backgroundImagePath TEXT,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS ShareSection (
      id TEXT PRIMARY KEY NOT NULL, shareCollectionId TEXT NOT NULL, title TEXT NOT NULL, description TEXT,
      layout TEXT NOT NULL DEFAULT 'editorial', sortOrder INTEGER NOT NULL DEFAULT 0,
      CONSTRAINT ShareSection_shareCollectionId_fkey FOREIGN KEY (shareCollectionId) REFERENCES ShareCollection (id) ON DELETE CASCADE ON UPDATE CASCADE
    );
    CREATE TABLE IF NOT EXISTS ShareCollectionItem (
      id TEXT PRIMARY KEY NOT NULL, shareCollectionId TEXT NOT NULL, cardId TEXT NOT NULL, sectionId TEXT,
      sortOrder INTEGER NOT NULL DEFAULT 0, displayTitle TEXT, displayDescription TEXT,
      CONSTRAINT ShareCollectionItem_shareCollectionId_fkey FOREIGN KEY (shareCollectionId) REFERENCES ShareCollection (id) ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT ShareCollectionItem_sectionId_fkey FOREIGN KEY (sectionId) REFERENCES ShareSection (id) ON DELETE SET NULL ON UPDATE CASCADE,
      CONSTRAINT ShareCollectionItem_cardId_fkey FOREIGN KEY (cardId) REFERENCES Card (id) ON DELETE CASCADE ON UPDATE CASCADE
    );
    CREATE TABLE IF NOT EXISTS PortfolioSavedView (
      id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, queryJson TEXT NOT NULL,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS PortfolioSnapshotRecord (
      id TEXT PRIMARY KEY NOT NULL, savedViewId TEXT, name TEXT NOT NULL, queryJson TEXT NOT NULL,
      snapshotJson TEXT NOT NULL, capturedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT PortfolioSnapshotRecord_savedViewId_fkey FOREIGN KEY (savedViewId) REFERENCES PortfolioSavedView (id) ON DELETE SET NULL ON UPDATE CASCADE
    );

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
    CREATE UNIQUE INDEX IF NOT EXISTS CardTransaction_externalKey_key ON CardTransaction(externalKey);
    CREATE INDEX IF NOT EXISTS CardTransaction_cardId_occurredAt_idx ON CardTransaction(cardId, occurredAt DESC);
    CREATE INDEX IF NOT EXISTS CardTransaction_kind_idx ON CardTransaction(kind);
    CREATE INDEX IF NOT EXISTS CardTransaction_occurredAt_idx ON CardTransaction(occurredAt DESC);
    CREATE UNIQUE INDEX IF NOT EXISTS CardExpense_externalKey_key ON CardExpense(externalKey);
    CREATE INDEX IF NOT EXISTS CardExpense_cardId_occurredAt_idx ON CardExpense(cardId, occurredAt DESC);
    CREATE INDEX IF NOT EXISTS CardExpense_kind_idx ON CardExpense(kind);
    CREATE INDEX IF NOT EXISTS CardExpense_transactionId_idx ON CardExpense(transactionId);
    CREATE INDEX IF NOT EXISTS CardExpense_occurredAt_idx ON CardExpense(occurredAt DESC);
    CREATE UNIQUE INDEX IF NOT EXISTS CardValuation_externalKey_key ON CardValuation(externalKey);
    CREATE INDEX IF NOT EXISTS CardValuation_cardId_valuedAt_idx ON CardValuation(cardId, valuedAt DESC);
    CREATE INDEX IF NOT EXISTS CardValuation_valuedAt_idx ON CardValuation(valuedAt DESC);
    CREATE INDEX IF NOT EXISTS CardEntryDraft_status_updatedAt_idx ON CardEntryDraft(status, updatedAt DESC);
    CREATE INDEX IF NOT EXISTS CardEntryDraft_updatedAt_idx ON CardEntryDraft(updatedAt DESC);
    CREATE UNIQUE INDEX IF NOT EXISTS CardEntryTemplate_name_key ON CardEntryTemplate(name);
    CREATE INDEX IF NOT EXISTS CardEntryTemplate_lastUsedAt_idx ON CardEntryTemplate(lastUsedAt DESC);
    CREATE INDEX IF NOT EXISTS CardEntryTemplate_updatedAt_idx ON CardEntryTemplate(updatedAt DESC);
    CREATE INDEX IF NOT EXISTS CardEntryBatch_createdAt_idx ON CardEntryBatch(createdAt DESC);
    CREATE INDEX IF NOT EXISTS CardEntryQueueItem_batchId_sortOrder_idx ON CardEntryQueueItem(batchId, sortOrder);
    CREATE INDEX IF NOT EXISTS CardEntryQueueItem_status_createdAt_idx ON CardEntryQueueItem(status, createdAt);
    CREATE INDEX IF NOT EXISTS CardEntryQueueImage_itemId_sortOrder_idx ON CardEntryQueueImage(itemId, sortOrder);
    CREATE UNIQUE INDEX IF NOT EXISTS CardEntryRecognition_itemId_key ON CardEntryRecognition(itemId);
    CREATE INDEX IF NOT EXISTS CardEntryRecognition_status_updatedAt_idx ON CardEntryRecognition(status, updatedAt);
    CREATE UNIQUE INDEX IF NOT EXISTS ShareCollection_slug_key ON ShareCollection(slug);
    CREATE INDEX IF NOT EXISTS ShareCollection_createdAt_idx ON ShareCollection(createdAt DESC);
    CREATE INDEX IF NOT EXISTS ShareSection_shareCollectionId_idx ON ShareSection(shareCollectionId);
    CREATE INDEX IF NOT EXISTS ShareSection_sortOrder_idx ON ShareSection(sortOrder);
    CREATE UNIQUE INDEX IF NOT EXISTS ShareCollectionItem_shareCollectionId_cardId_key ON ShareCollectionItem(shareCollectionId, cardId);
    CREATE INDEX IF NOT EXISTS ShareCollectionItem_shareCollectionId_idx ON ShareCollectionItem(shareCollectionId);
    CREATE INDEX IF NOT EXISTS ShareCollectionItem_sectionId_idx ON ShareCollectionItem(sectionId);
    CREATE INDEX IF NOT EXISTS ShareCollectionItem_cardId_idx ON ShareCollectionItem(cardId);
    CREATE INDEX IF NOT EXISTS ShareCollectionItem_sortOrder_idx ON ShareCollectionItem(sortOrder);
    CREATE UNIQUE INDEX IF NOT EXISTS PortfolioSavedView_name_key ON PortfolioSavedView(name);
    CREATE INDEX IF NOT EXISTS PortfolioSavedView_updatedAt_idx ON PortfolioSavedView(updatedAt DESC);
    CREATE INDEX IF NOT EXISTS PortfolioSnapshotRecord_savedViewId_capturedAt_idx ON PortfolioSnapshotRecord(savedViewId, capturedAt DESC);
    CREATE INDEX IF NOT EXISTS PortfolioSnapshotRecord_capturedAt_idx ON PortfolioSnapshotRecord(capturedAt DESC);

    CREATE TRIGGER IF NOT EXISTS CardTransaction_currency_insert_check BEFORE INSERT ON CardTransaction
      WHEN NEW.currency NOT IN ('CNY', 'USD') BEGIN SELECT RAISE(ABORT, 'currency must be CNY or USD'); END;
    CREATE TRIGGER IF NOT EXISTS CardTransaction_currency_update_check BEFORE UPDATE OF currency ON CardTransaction
      WHEN NEW.currency NOT IN ('CNY', 'USD') BEGIN SELECT RAISE(ABORT, 'currency must be CNY or USD'); END;
    CREATE TRIGGER IF NOT EXISTS CardExpense_currency_insert_check BEFORE INSERT ON CardExpense
      WHEN NEW.currency NOT IN ('CNY', 'USD') BEGIN SELECT RAISE(ABORT, 'currency must be CNY or USD'); END;
    CREATE TRIGGER IF NOT EXISTS CardExpense_currency_update_check BEFORE UPDATE OF currency ON CardExpense
      WHEN NEW.currency NOT IN ('CNY', 'USD') BEGIN SELECT RAISE(ABORT, 'currency must be CNY or USD'); END;
    CREATE TRIGGER IF NOT EXISTS CardValuation_currency_insert_check BEFORE INSERT ON CardValuation
      WHEN NEW.currency NOT IN ('CNY', 'USD') BEGIN SELECT RAISE(ABORT, 'currency must be CNY or USD'); END;
    CREATE TRIGGER IF NOT EXISTS CardValuation_currency_update_check BEFORE UPDATE OF currency ON CardValuation
      WHEN NEW.currency NOT IN ('CNY', 'USD') BEGIN SELECT RAISE(ABORT, 'currency must be CNY or USD'); END;
  `);
}

function escapedSqlString(value) {
  return String(value).replaceAll("'", "''");
}

function sqliteCalendarDate(expression) {
  return `CASE WHEN typeof(${expression}) = 'integer'
    THEN date(${expression} / 1000, 'unixepoch')
    ELSE date(${expression}) END`;
}

function createUpgradeSnapshot(db, dbPath) {
  const backupDirectory = path.join(path.dirname(dbPath), "schema-backups");
  fs.mkdirSync(backupDirectory, { recursive: true });
  const timestamp = new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
  const backupPath = path.join(backupDirectory, `card-vault-before-v${schemaVersion}-${timestamp}.db`);
  db.exec(`VACUUM INTO '${escapedSqlString(backupPath)}';`);
  return backupPath;
}

function addCardImageRotation(db) {
  const columns = new Set(db.prepare("PRAGMA table_info(CardImage)").all().map((column) => column.name));
  if (!columns.has("rotation")) {
    db.exec("ALTER TABLE CardImage ADD COLUMN rotation INTEGER NOT NULL DEFAULT 0 CHECK (rotation IN (0, 90, 180, 270));");
  }
}

function upgradeV110ToV111(db) {
  const refundCount = Number(db.prepare("SELECT COUNT(*) AS count FROM CardTransaction WHERE kind = 'refund'").get().count);
  if (refundCount > 0) {
    throw new Error(`数据库中仍有 ${refundCount} 条退款记录，v${schemaVersion} 不支持自动删除这些业务数据。请先在 v1.1.0 中处理后再升级。`);
  }

  const sameDayShippingCount = Number(db.prepare(`
    SELECT COUNT(*) AS count
    FROM CardExpense expense
    JOIN Card card ON card.id = expense.cardId
    WHERE expense.kind = 'shipping'
      AND (
        (card.purchaseDate IS NOT NULL
          AND ${sqliteCalendarDate("expense.occurredAt")} = ${sqliteCalendarDate("card.purchaseDate")})
        OR EXISTS (
          SELECT 1 FROM CardTransaction transactionRow
          WHERE transactionRow.cardId = card.id
            AND transactionRow.kind = 'purchase'
            AND ${sqliteCalendarDate("transactionRow.occurredAt")} = ${sqliteCalendarDate("expense.occurredAt")}
        )
      )
  `).get().count);
  const shippingCount = Number(db.prepare("SELECT COUNT(*) AS count FROM CardExpense WHERE kind = 'shipping'").get().count);

  db.exec("PRAGMA foreign_keys = OFF;");
  db.exec("BEGIN IMMEDIATE;");
  try {
    db.exec(`
      ALTER TABLE Card ADD COLUMN holdingQuantity INTEGER NOT NULL DEFAULT 1
        CHECK (typeof(holdingQuantity) = 'integer' AND holdingQuantity >= 0);
      ALTER TABLE CardExpense ADD COLUMN context TEXT NOT NULL DEFAULT 'grading'
        CHECK (context IN ('purchase', 'grading', 'sale'));
      ALTER TABLE CardExpense ADD COLUMN transactionId TEXT;

      UPDATE CardExpense
      SET context = CASE
        WHEN kind = 'shipping' AND EXISTS (
          SELECT 1 FROM Card
          WHERE Card.id = CardExpense.cardId
            AND (
              (Card.purchaseDate IS NOT NULL
                AND ${sqliteCalendarDate("CardExpense.occurredAt")} = ${sqliteCalendarDate("Card.purchaseDate")})
              OR EXISTS (
                SELECT 1 FROM CardTransaction
                WHERE CardTransaction.cardId = Card.id
                  AND CardTransaction.kind = 'purchase'
                  AND ${sqliteCalendarDate("CardTransaction.occurredAt")} = ${sqliteCalendarDate("CardExpense.occurredAt")}
              )
            )
        ) THEN 'purchase'
        WHEN kind = 'marketplace_fee' THEN 'sale'
        ELSE 'grading'
      END;

      UPDATE Card
      SET holdingQuantity = CASE
        WHEN EXISTS (SELECT 1 FROM CardTransaction WHERE CardTransaction.cardId = Card.id)
          THEN max(0, COALESCE((
            SELECT SUM(CASE WHEN kind = 'purchase' THEN quantity ELSE -quantity END)
            FROM CardTransaction WHERE CardTransaction.cardId = Card.id
          ), 0))
        WHEN collectionStatus IN ('sold', 'target') THEN 0
        ELSE 1
      END;

      UPDATE Card
      SET
        purchasePrice = CASE WHEN EXISTS (
          SELECT 1 FROM CardTransaction
          WHERE CardTransaction.cardId = Card.id AND kind = 'purchase' AND currency = 'CNY'
        ) THEN (
          SELECT SUM(amountMinor) / 100.0 FROM CardTransaction
          WHERE CardTransaction.cardId = Card.id AND kind = 'purchase' AND currency = 'CNY'
        ) ELSE purchasePrice END,
        gradingFee = CASE WHEN EXISTS (
          SELECT 1 FROM CardExpense
          WHERE CardExpense.cardId = Card.id AND kind = 'grading' AND currency = 'CNY'
        ) THEN (
          SELECT SUM(amountMinor) / 100.0 FROM CardExpense
          WHERE CardExpense.cardId = Card.id AND kind = 'grading' AND currency = 'CNY'
        ) ELSE gradingFee END,
        totalCost = CASE WHEN EXISTS (
          SELECT 1 FROM CardTransaction
          WHERE CardTransaction.cardId = Card.id AND kind = 'purchase' AND currency = 'CNY'
        ) THEN (
          (
            COALESCE((SELECT SUM(amountMinor) FROM CardTransaction
              WHERE CardTransaction.cardId = Card.id AND kind = 'purchase' AND currency = 'CNY'), 0)
            + COALESCE((SELECT SUM(amountMinor) FROM CardExpense
              WHERE CardExpense.cardId = Card.id AND context IN ('purchase', 'grading') AND currency = 'CNY'), 0)
          ) / 100.0
          * max(0, COALESCE((SELECT SUM(CASE WHEN kind = 'purchase' THEN quantity ELSE -quantity END)
            FROM CardTransaction WHERE CardTransaction.cardId = Card.id AND currency = 'CNY'), 0))
          / max(1, COALESCE((SELECT SUM(quantity) FROM CardTransaction
            WHERE CardTransaction.cardId = Card.id AND kind = 'purchase' AND currency = 'CNY'), 0))
        ) ELSE totalCost END;

      DROP TRIGGER IF EXISTS CardTransaction_currency_insert_check;
      DROP TRIGGER IF EXISTS CardTransaction_currency_update_check;
      CREATE TABLE CardTransaction_v111 (
        id TEXT PRIMARY KEY NOT NULL, cardId TEXT NOT NULL,
        kind TEXT NOT NULL CHECK (kind IN ('purchase', 'sale')),
        amountMinor INTEGER NOT NULL CHECK (typeof(amountMinor) = 'integer' AND amountMinor >= 0),
        currency TEXT NOT NULL DEFAULT 'CNY' CHECK (length(currency) = 3 AND currency = upper(currency)),
        quantity INTEGER NOT NULL DEFAULT 1 CHECK (typeof(quantity) = 'integer' AND quantity > 0),
        occurredAt DATETIME NOT NULL, source TEXT, notes TEXT,
        provenance TEXT NOT NULL CHECK (length(trim(provenance)) > 0), externalKey TEXT,
        createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT CardTransaction_cardId_fkey FOREIGN KEY (cardId) REFERENCES Card (id) ON DELETE CASCADE ON UPDATE CASCADE
      );
      INSERT INTO CardTransaction_v111
        (id, cardId, kind, amountMinor, currency, quantity, occurredAt, source, notes, provenance, externalKey, createdAt, updatedAt)
      SELECT id, cardId, kind, amountMinor, currency, quantity, occurredAt, source, notes, provenance, externalKey, createdAt, updatedAt
      FROM CardTransaction;
      DROP TABLE CardTransaction;
      ALTER TABLE CardTransaction_v111 RENAME TO CardTransaction;
    `);
    db.exec("COMMIT;");
  } catch (error) {
    db.exec("ROLLBACK;");
    throw error;
  } finally {
    db.exec("PRAGMA foreign_keys = ON;");
  }
  return {
    expenseBackfillCount: Number(db.prepare("SELECT COUNT(*) AS count FROM CardExpense").get().count),
    purchaseShippingCount: sameDayShippingCount,
    gradingShippingCount: shippingCount - sameDayShippingCount
  };
}

function initializeDatabase(dbPath) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  try {
    db.exec("PRAGMA foreign_keys = ON;");
    const initialized = applicationTableNames(db).length === 0;
    let upgraded = false;
    let backupPath = null;
    let expenseBackfill = null;
    let upgradeSource = null;
    let addImageRotation = false;
    if (!initialized) {
      const currentIssues = schemaIssues(db, requiredSchema);
      if (currentIssues.length > 0) {
        const preRotationIssues = schemaIssues(db, preRotationRequiredSchema);
        const prePortfolioIssues = schemaIssues(db, prePortfolioRequiredSchema);
        const prePortfolioPreRotationIssues = schemaIssues(db, prePortfolioPreRotationRequiredSchema);
        if (schemaIssues(db, v120RequiredSchema).length === 0) {
          backupPath = createUpgradeSnapshot(db, dbPath);
          upgradeSource = "1.2.0";
          upgraded = true;
        } else if (preRotationIssues.length === 0) {
          backupPath = createUpgradeSnapshot(db, dbPath);
          upgradeSource = previousSchemaVersion;
          addImageRotation = true;
          upgraded = true;
        } else if (prePortfolioIssues.length === 0) {
          backupPath = createUpgradeSnapshot(db, dbPath);
          upgradeSource = previousSchemaVersion;
          upgraded = true;
        } else if (prePortfolioPreRotationIssues.length === 0) {
          backupPath = createUpgradeSnapshot(db, dbPath);
          upgradeSource = previousSchemaVersion;
          addImageRotation = true;
          upgraded = true;
        } else {
          const v110Issues = schemaIssues(db, v110RequiredSchema);
          if (v110Issues.length > 0) {
            throw new Error(`数据库不是 Card Vault v1.1.0、v${previousSchemaVersion}、v1.2.0 或 v${schemaVersion} 支持结构：${v110Issues.join("；")}。`);
          }
          backupPath = createUpgradeSnapshot(db, dbPath);
          expenseBackfill = upgradeV110ToV111(db);
          upgradeSource = "v1.1.0";
          addImageRotation = true;
          upgraded = true;
        }
      }
    }
    if (!initialized && managementSchemaNeeded(db) && !backupPath) {
      backupPath = createUpgradeSnapshot(db, dbPath);
      upgraded = true;
      upgradeSource = "1.3.0-core";
    }
    db.exec("BEGIN IMMEDIATE;");
    try {
      if (addImageRotation) addCardImageRotation(db);
      createCurrentSchema(db);
      const transactionColumns = new Set(db.prepare("PRAGMA table_info(CardTransaction)").all().map((column) => column.name));
      if (!transactionColumns.has("paymentsJson")) db.exec("ALTER TABLE CardTransaction ADD COLUMN paymentsJson TEXT;");
      if (!transactionColumns.has("amountKnown")) {
        db.exec("ALTER TABLE CardTransaction ADD COLUMN amountKnown BOOLEAN NOT NULL DEFAULT 1 CHECK(amountKnown IN (0,1));");
        if (!initialized) db.exec("UPDATE CardTransaction SET amountKnown = 0 WHERE amountMinor = 0;");
      }
      db.exec(`
        CREATE TABLE IF NOT EXISTS FinancialSettings (id TEXT PRIMARY KEY NOT NULL, reportingCurrency TEXT NOT NULL DEFAULT 'CNY' CHECK(reportingCurrency IN ('CNY','USD')));
        CREATE TABLE IF NOT EXISTS ExchangeRate (id TEXT PRIMARY KEY NOT NULL, effectiveDate TEXT NOT NULL, rateMicros INTEGER NOT NULL CHECK(typeof(rateMicros) = 'integer' AND rateMicros > 0), source TEXT NOT NULL, revision INTEGER NOT NULL CHECK(revision > 0), createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP);
        CREATE UNIQUE INDEX IF NOT EXISTS ExchangeRate_effectiveDate_revision_key ON ExchangeRate(effectiveDate, revision);
        CREATE INDEX IF NOT EXISTS ExchangeRate_effectiveDate_idx ON ExchangeRate(effectiveDate);
      `);
      createManagementSchema(db);
      validateCurrentSchema(db);
      db.exec("COMMIT;");
    } catch (error) {
      db.exec("ROLLBACK;");
      throw error;
    }
    validateCurrentSchema(db);
    const integrity = db.prepare("PRAGMA integrity_check;").all();
    const valid = integrity.length === 1 && Object.values(integrity[0]).some((value) => String(value).toLowerCase() === "ok");
    if (!valid) throw new Error("Database integrity check failed after schema initialization.");
    return { dbPath, schemaVersion, initialized, upgraded, upgradeSource, backupPath, expenseBackfill };
  } finally {
    db.close();
  }
}

module.exports = { initializeDatabase, schemaVersion, validateCurrentSchema };
