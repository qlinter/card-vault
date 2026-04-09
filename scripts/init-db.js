const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const { resolveDbPath } = require("./storage-paths");

const rootDir = path.resolve(__dirname, "..");
const dbPath = resolveDbPath(rootDir);
const dbDir = path.dirname(dbPath);

fs.mkdirSync(dbDir, { recursive: true });

const db = new DatabaseSync(dbPath);

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

function recreateCardTableWithTextFields() {
  db.exec("PRAGMA foreign_keys = OFF;");

  db.exec(`
    CREATE TABLE IF NOT EXISTS Card_new (
      id TEXT PRIMARY KEY NOT NULL,
      playerName TEXT NOT NULL,
      cardTitle TEXT NOT NULL,
      sport TEXT NOT NULL,
      team TEXT,
      year TEXT,
      setName TEXT,
      cardNumber TEXT,
      isSerialNumbered BOOLEAN NOT NULL DEFAULT 0,
      serialNumber TEXT,
      serialRange TEXT,
      isAutograph BOOLEAN NOT NULL DEFAULT 0,
      isPatch BOOLEAN NOT NULL DEFAULT 0,
      gradingCompany TEXT,
      grade TEXT,
      gradingLink TEXT,
      purchaseDate DATETIME,
      purchasePrice REAL,
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
      setName,
      cardNumber,
      isSerialNumbered,
      serialNumber,
      serialRange,
      isAutograph,
      isPatch,
      gradingCompany,
      grade,
      gradingLink,
      purchaseDate,
      purchasePrice,
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
      setName,
      cardNumber,
      isSerialNumbered,
      serialNumber,
      serialRange,
      isAutograph,
      isPatch,
      gradingCompany,
      CASE WHEN grade IS NULL THEN NULL ELSE CAST(grade AS TEXT) END,
      gradingLink,
      purchaseDate,
      purchasePrice,
      currentValue,
      purchaseSource,
      tags,
      publicDescription,
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
  setName TEXT,
  cardNumber TEXT,
  isSerialNumbered BOOLEAN NOT NULL DEFAULT 0,
  serialNumber TEXT,
  serialRange TEXT,
  isAutograph BOOLEAN NOT NULL DEFAULT 0,
  isPatch BOOLEAN NOT NULL DEFAULT 0,
  gradingCompany TEXT,
  grade TEXT,
  gradingLink TEXT,
  purchaseDate DATETIME,
  purchasePrice REAL,
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
`);

try {
  db.exec("ALTER TABLE Card ADD COLUMN publicDescription TEXT;");
} catch {
  // column already exists
}

try {
  db.exec("ALTER TABLE Card ADD COLUMN currentValue REAL;");
} catch {
  // column already exists
}

try {
  db.exec("ALTER TABLE Card ADD COLUMN gradingLink TEXT;");
} catch {
  // column already exists
}

const cardColumnTypes = getCardColumnTypes();
if (cardColumnTypes.year && cardColumnTypes.year !== "TEXT") {
  recreateCardTableWithTextFields();
}

db.exec(`
CREATE INDEX IF NOT EXISTS Card_playerName_idx ON Card(playerName);
CREATE INDEX IF NOT EXISTS Card_cardTitle_idx ON Card(cardTitle);
CREATE INDEX IF NOT EXISTS Card_sport_idx ON Card(sport);
CREATE INDEX IF NOT EXISTS Card_team_idx ON Card(team);
CREATE INDEX IF NOT EXISTS Card_year_idx ON Card(year);
CREATE INDEX IF NOT EXISTS Card_setName_idx ON Card(setName);
CREATE INDEX IF NOT EXISTS Card_createdAt_idx ON Card(createdAt DESC);
CREATE INDEX IF NOT EXISTS CardImage_cardId_idx ON CardImage(cardId);
`);

console.log(`Database ready: ${dbPath}`);
