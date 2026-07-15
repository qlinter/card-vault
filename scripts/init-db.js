const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const { resolveDbPath } = require("./storage-paths");

const rootDir = path.resolve(__dirname, "..");
const dbPath = resolveDbPath(rootDir);
const dbDir = path.dirname(dbPath);

fs.mkdirSync(dbDir, { recursive: true });

const db = new DatabaseSync(dbPath);

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
const shareCollectionColumns = [["backgroundImagePath", "TEXT"]];

function getCardColumnTypes() {
  try {
    return db
      .prepare("PRAGMA table_info(Card)")
      .all()
      .reduce((map, column) => {
        map[column.name] = String(column.type || "").toUpperCase();
        return map;
      }, {});
  } catch {
    return {};
  }
}

function columnExists(tableName, columnName) {
  return db.prepare(`PRAGMA table_info(${tableName})`).all().some((column) => column.name === columnName);
}

function addColumnIfMissing(tableName, columnName, definition) {
  if (columnExists(tableName, columnName)) {
    return;
  }

  db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition};`);
}

function selectableColumn(columnName, fallbackSql = "NULL") {
  return columnExists("Card", columnName) ? columnName : fallbackSql;
}

function productLineSelectSql() {
  const hasProductLine = columnExists("Card", "productLine");
  const hasSetName = columnExists("Card", "setName");

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

function recreateCardTableWithoutSetName() {
  db.exec("PRAGMA foreign_keys = OFF;");

  db.exec(`
    CREATE TABLE IF NOT EXISTS Card_new (
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
  `);

  db.exec(`
    INSERT INTO Card_new (
      id,
      playerName,
      cardTitle,
      sport,
      team,
      year,
      brand,
      productLine,
      subsetName,
      parallel,
      cardNumber,
      isSerialNumbered,
      serialNumber,
      serialRange,
      isRookie,
      isAutograph,
      autoType,
      isPatch,
      patchType,
      gradingCompany,
      grade,
      certNumber,
      gradingLink,
      visibility,
      collectionStatus,
      purchaseDate,
      purchasePrice,
      gradingFee,
      totalCost,
      currentValue,
      purchaseSource,
      tags,
      publicDescription,
      notes,
      createdAt,
      updatedAt
    )
    SELECT
      id,
      playerName,
      cardTitle,
      sport,
      team,
      CASE WHEN year IS NULL THEN NULL ELSE CAST(year AS TEXT) END,
      ${selectableColumn("brand")},
      ${productLineSelectSql()},
      ${selectableColumn("subsetName")},
      ${selectableColumn("parallel")},
      cardNumber,
      isSerialNumbered,
      serialNumber,
      serialRange,
      ${selectableColumn("isRookie", "0")},
      isAutograph,
      ${selectableColumn("autoType")},
      isPatch,
      ${selectableColumn("patchType")},
      gradingCompany,
      CASE WHEN grade IS NULL THEN NULL ELSE CAST(grade AS TEXT) END,
      ${selectableColumn("certNumber")},
      ${selectableColumn("gradingLink")},
      ${selectableColumn("visibility", "'private'")},
      ${selectableColumn("collectionStatus", "'holding'")},
      purchaseDate,
      purchasePrice,
      ${selectableColumn("gradingFee")},
      ${selectableColumn("totalCost")},
      ${selectableColumn("currentValue")},
      purchaseSource,
      tags,
      ${selectableColumn("publicDescription")},
      notes,
      createdAt,
      updatedAt
    FROM Card;
  `);

  db.exec("DROP TABLE Card;");
  db.exec("ALTER TABLE Card_new RENAME TO Card;");
  db.exec("PRAGMA foreign_keys = ON;");
}

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
  description TEXT,
  themeNarrative TEXT,
  themeHighlights TEXT,
  groupNotes TEXT,
  coverImagePath TEXT,
  backgroundImagePath TEXT,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS ShareCollectionItem (
  id TEXT PRIMARY KEY NOT NULL,
  shareCollectionId TEXT NOT NULL,
  cardId TEXT NOT NULL,
  sortOrder INTEGER NOT NULL DEFAULT 0,
  displayTitle TEXT,
  displayDescription TEXT,
  CONSTRAINT ShareCollectionItem_shareCollectionId_fkey FOREIGN KEY (shareCollectionId) REFERENCES ShareCollection (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT ShareCollectionItem_cardId_fkey FOREIGN KEY (cardId) REFERENCES Card (id) ON DELETE CASCADE ON UPDATE CASCADE
);
`);

for (const [columnName, definition] of cardColumns) {
  addColumnIfMissing("Card", columnName, definition);
}

for (const [columnName, definition] of shareCollectionColumns) {
  addColumnIfMissing("ShareCollection", columnName, definition);
}

const cardColumnTypes = getCardColumnTypes();
if (
  columnExists("Card", "setName") ||
  (cardColumnTypes.year && cardColumnTypes.year !== "TEXT") ||
  (cardColumnTypes.grade && cardColumnTypes.grade !== "TEXT")
) {
  recreateCardTableWithoutSetName();
}

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
CREATE UNIQUE INDEX IF NOT EXISTS ShareCollectionItem_shareCollectionId_cardId_key ON ShareCollectionItem(shareCollectionId, cardId);
CREATE INDEX IF NOT EXISTS ShareCollectionItem_shareCollectionId_idx ON ShareCollectionItem(shareCollectionId);
CREATE INDEX IF NOT EXISTS ShareCollectionItem_cardId_idx ON ShareCollectionItem(cardId);
CREATE INDEX IF NOT EXISTS ShareCollectionItem_sortOrder_idx ON ShareCollectionItem(sortOrder);
`);

console.log(`Database ready: ${dbPath}`);
