const managementTables = {
  DataRevision: ["id", "revision", "projectionRevision", "projectionDay"],
  CardReport: ["cardId", "currency", "remainingCostMinor", "valueMinor", "quantity"],
  BulkJob: ["id", "token", "kind", "status", "optionsJson", "createdAt", "updatedAt"],
  BulkJobRow: ["id", "jobId", "rowNumber", "inputJson", "status", "error", "cardId", "beforeJson", "afterJson"],
  CollectionTaskState: ["id", "status", "snoozedUntil", "fingerprint", "updatedAt"],
  CollectionPlan: ["id", "title", "playerName", "sport", "budgetMinor", "currency", "targetDate", "notes", "status", "cardId", "createdAt", "updatedAt"],
  ManagementSettings: ["id", "notifications", "digestCadence", "lastNotifiedAt"]
};
function managementSchemaNeeded(db) {
  return Object.entries(managementTables).some(([table, fields]) => {
    const columns = new Set(db.prepare(`PRAGMA table_info("${table}")`).all().map(row => row.name));
    return fields.some(field => !columns.has(field));
  });
}
function createManagementSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS DataRevision(id INTEGER PRIMARY KEY NOT NULL DEFAULT 1, revision INTEGER NOT NULL DEFAULT 0, projectionRevision INTEGER NOT NULL DEFAULT -1, projectionDay TEXT NOT NULL DEFAULT '');
    INSERT OR IGNORE INTO DataRevision(id) VALUES(1);
    CREATE TABLE IF NOT EXISTS CardReport(cardId TEXT PRIMARY KEY NOT NULL REFERENCES Card(id) ON DELETE CASCADE, currency TEXT NOT NULL CHECK(currency IN ('CNY','USD')), remainingCostMinor INTEGER, valueMinor INTEGER, quantity INTEGER NOT NULL CHECK(quantity >= 0));
    CREATE INDEX IF NOT EXISTS CardReport_remainingCostMinor_cardId_idx ON CardReport(remainingCostMinor, cardId);
    CREATE INDEX IF NOT EXISTS CardReport_valueMinor_cardId_idx ON CardReport(valueMinor, cardId);
    CREATE TABLE IF NOT EXISTS BulkJob(id TEXT PRIMARY KEY NOT NULL, token TEXT NOT NULL, kind TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'preview', optionsJson TEXT NOT NULL, createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE UNIQUE INDEX IF NOT EXISTS BulkJob_token_key ON BulkJob(token);
    CREATE TABLE IF NOT EXISTS BulkJobRow(id TEXT PRIMARY KEY NOT NULL, jobId TEXT NOT NULL REFERENCES BulkJob(id) ON DELETE CASCADE, rowNumber INTEGER NOT NULL, inputJson TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', error TEXT, cardId TEXT, beforeJson TEXT, afterJson TEXT);
    CREATE UNIQUE INDEX IF NOT EXISTS BulkJobRow_jobId_rowNumber_key ON BulkJobRow(jobId,rowNumber);
    CREATE INDEX IF NOT EXISTS BulkJobRow_jobId_status_idx ON BulkJobRow(jobId,status);
    CREATE TABLE IF NOT EXISTS CollectionTaskState(id TEXT PRIMARY KEY NOT NULL, status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','dismissed','done','snoozed')), snoozedUntil DATETIME, fingerprint TEXT NOT NULL, updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS CollectionPlan(id TEXT PRIMARY KEY NOT NULL, title TEXT NOT NULL, playerName TEXT, sport TEXT, budgetMinor INTEGER CHECK(budgetMinor IS NULL OR budgetMinor >= 0), currency TEXT NOT NULL DEFAULT 'CNY' CHECK(currency IN ('CNY','USD')), targetDate DATETIME, notes TEXT, status TEXT NOT NULL DEFAULT 'planned' CHECK(status IN ('planned','acquired','cancelled')), cardId TEXT, createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE INDEX IF NOT EXISTS CollectionPlan_status_targetDate_idx ON CollectionPlan(status,targetDate);
    CREATE TABLE IF NOT EXISTS ManagementSettings(id TEXT PRIMARY KEY NOT NULL DEFAULT 'default', notifications BOOLEAN NOT NULL DEFAULT 0 CHECK(notifications IN(0,1)), digestCadence TEXT NOT NULL DEFAULT 'weekly' CHECK(digestCadence IN ('weekly','monthly')), lastNotifiedAt DATETIME);
  `);
  for (const table of ["Card", "CardImage", "CardTransaction", "CardExpense", "CardValuation", "FinancialSettings", "ExchangeRate"]) {
    for (const operation of ["INSERT", "UPDATE", "DELETE"]) {
      db.exec(`CREATE TRIGGER IF NOT EXISTS revision_${table}_${operation} AFTER ${operation} ON ${table} BEGIN UPDATE DataRevision SET revision=revision+1 WHERE id=1; END;`);
    }
  }
  if (managementSchemaNeeded(db)) throw new Error("管理数据结构不完整，升级已取消。");
}
module.exports = { createManagementSchema, managementSchemaNeeded };
