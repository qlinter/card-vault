const fs = require("node:fs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { DatabaseSync } = require("node:sqlite");
const { valuationSources, canonicalValuationSource } = require("../lib/valuation-sources");
const { createDatabaseSnapshot } = require("../electron/storage/database-snapshot");

function normalizeStoredSources(value, valuationContext = false) {
  if (Array.isArray(value)) return value.map(item => normalizeStoredSources(item, valuationContext));
  if (!value || typeof value !== "object") return value;
  const result = {};
  for (const [key, entry] of Object.entries(value)) {
    if ((key === "valuationSource" || (key === "source" && (valuationContext || value.type === "valuation"))) && typeof entry === "string") result[key] = canonicalValuationSource(entry);
    else if (key === "valuationSources" && Array.isArray(entry)) {
      const sources = new Map();
      for (const row of entry) { const name = canonicalValuationSource(row.name); const previous = sources.get(name); if (previous) previous.count += row.count; else sources.set(name, { ...row, name }); }
      result[key] = [...sources.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
    } else result[key] = normalizeStoredSources(entry, key === "valuations" || valuationContext || value.type === "valuation");
  }
  return result;
}
const quote = value => '"' + value.replaceAll('"', '""') + '"';
function normalizeValuationSourceSchema(dbPath, options = {}) {
  const db = new DatabaseSync(dbPath);
  let transaction = false;
  try {
    db.exec("PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON; BEGIN IMMEDIATE");
    transaction = true;
    const table = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='CardValuation'").get();
    if (!table) { db.exec("COMMIT"); transaction = false; return { changed: false, valuations: 0, storedRecords: 0, backupPath: null }; }
    const oldConstraint = /近期成交|平台报价/.test(table.sql);
    const changedCards = db.prepare("SELECT DISTINCT cardId FROM CardValuation WHERE source IN ('近期成交','平台报价')").all();
    const valuations = db.prepare("SELECT COUNT(*) count FROM CardValuation WHERE source IN ('近期成交','平台报价')").get().count;
    const updates = [];
    for (const [name, key, columns] of [["CardEntryDraft", "id", ["valuesJson"]], ["CardEntryTemplate", "id", ["valuesJson"]], ["BulkJobRow", "id", ["inputJson", "beforeJson", "afterJson"]], ["PortfolioSnapshotRecord", "id", ["snapshotJson"]]]) {
      if (!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(name)) continue;
      for (const column of columns) {
        const rows = db.prepare(`SELECT ${quote(key)} id, ${quote(column)} value FROM ${quote(name)} WHERE ${quote(column)} LIKE '%近期成交%' OR ${quote(column)} LIKE '%平台报价%'`).all();
        for (const row of rows) { const value = JSON.stringify(normalizeStoredSources(JSON.parse(row.value))); if (value !== JSON.stringify(JSON.parse(row.value))) updates.push({ name, key, column, id: row.id, value }); }
      }
    }
    if (!oldConstraint && valuations === 0 && updates.length === 0) { db.exec("COMMIT"); transaction = false; return { changed: false, valuations: 0, storedRecords: 0, backupPath: null }; }
    let backupPath = null;
    if (options.backup !== false) {
      const directory = options.backupRoot ?? path.join(path.dirname(dbPath), "schema-backups");
      fs.mkdirSync(directory, { recursive: true });
      backupPath = path.join(directory, `valuation-sources-${Date.now()}-${randomUUID()}.db`);
      createDatabaseSnapshot(dbPath, backupPath);
    }
      if (oldConstraint) {
        // Cross-table reporting triggers refer to this table too. Preserve them while
        // the table is replaced so SQLite can validate ALTER TABLE against a full schema.
        const objects = db.prepare("SELECT type,name,sql FROM sqlite_master WHERE sql IS NOT NULL AND (type='trigger' OR (type='index' AND tbl_name='CardValuation'))").all();
        const columns = db.prepare("PRAGMA table_info(CardValuation)").all().map(row => row.name);
        const sources = valuationSources.map(value => `'${value.replaceAll("'", "''")}'`).join(",");
        const sql = table.sql.replace(/^(CREATE TABLE(?: IF NOT EXISTS)?)\s+(?:"CardValuation"|CardValuation)/i, "$1 CardValuation_source_update").replace(/CHECK\s*\(\s*source\s+IN\s*\([^)]*\)\s*\)/i, `CHECK (source IN (${sources}))`);
        if (!sql.includes("CardValuation_source_update") || /近期成交|平台报价/.test(sql)) throw new Error("估值来源约束无法安全更新，原数据未修改。");
        db.exec(sql);
        const selected = columns.map(column => column === "source" ? "CASE source WHEN '近期成交' THEN '卡淘' WHEN '平台报价' THEN 'Others' ELSE source END" : quote(column));
        db.exec(`INSERT INTO CardValuation_source_update (${columns.map(quote).join(",")}) SELECT ${selected.join(",")} FROM CardValuation`);
        for (const object of objects) if (object.type === "trigger") db.exec(`DROP TRIGGER ${quote(object.name)}`);
        db.exec("DROP TABLE CardValuation; ALTER TABLE CardValuation_source_update RENAME TO CardValuation");
        for (const object of objects) db.exec(object.sql);
      } else db.exec("UPDATE CardValuation SET source=CASE source WHEN '近期成交' THEN '卡淘' WHEN '平台报价' THEN 'Others' ELSE source END WHERE source IN ('近期成交','平台报价')");
      for (const row of updates) db.prepare(`UPDATE ${quote(row.name)} SET ${quote(row.column)}=? WHERE ${quote(row.key)}=?`).run(row.value, row.id);
      for (const row of changedCards) {
        db.prepare("INSERT OR IGNORE INTO CardReportDirty(cardId) VALUES(?)").run(row.cardId);
        db.prepare("UPDATE CardTracking SET valuationRevision=valuationRevision+1 WHERE cardId=?").run(row.cardId);
      }
      if (valuations > 0) db.exec("UPDATE DataRevision SET revision=revision+1 WHERE id=1");
      if (db.prepare("PRAGMA foreign_key_check").all().length || db.prepare("PRAGMA integrity_check").get().integrity_check !== "ok") throw new Error("估值来源转换未通过数据库完整性检查，已撤销。");
      db.exec("COMMIT");
      transaction = false;
      return { changed: true, valuations, storedRecords: updates.length, backupPath };
  } finally { if (transaction) db.exec("ROLLBACK"); db.close(); }
}
module.exports = { normalizeValuationSourceSchema, normalizeStoredSources };
