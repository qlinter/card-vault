const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const { reportProgress } = require("./progress");

function sqliteStringLiteral(value) { return `'${String(value).replace(/'/g, "''")}'`; }

function createDatabaseSnapshot(sourceDbPath, targetDbPath, onProgress) {
  if (!fs.existsSync(sourceDbPath)) throw new Error("Database file does not exist.");
  fs.mkdirSync(path.dirname(targetDbPath), { recursive: true });
  reportProgress(onProgress, 10, "正在创建 SQLite 一致性快照...");
  const sourceDb = new DatabaseSync(sourceDbPath);
  try { sourceDb.exec(`VACUUM INTO ${sqliteStringLiteral(targetDbPath)};`); } finally { sourceDb.close(); }
  reportProgress(onProgress, 72, "正在验证备份数据库完整性...");
  const backupDb = new DatabaseSync(targetDbPath, { readOnly: true });
  try {
    const rows = backupDb.prepare("PRAGMA integrity_check;").all();
    if (!(rows.length === 1 && Object.values(rows[0]).some((value) => String(value).toLowerCase() === "ok"))) throw new Error("Backup database integrity check failed.");
  } finally { backupDb.close(); }
  reportProgress(onProgress, 100, "数据库快照已通过完整性检查。");
}

function copyDataFilesForBackup(sourceDataDir, targetDataDir, sourceDbPath, onProgress) {
  const sourceDbName = path.basename(sourceDbPath);
  const skipped = new Set([sourceDbName, `${sourceDbName}-journal`, `${sourceDbName}-shm`, `${sourceDbName}-wal`]);
  fs.mkdirSync(targetDataDir, { recursive: true });
  const entries = fs.readdirSync(sourceDataDir, { withFileTypes: true }).filter((entry) => !skipped.has(entry.name));
  for (const [index, entry] of entries.entries()) {
    fs.cpSync(path.join(sourceDataDir, entry.name), path.join(targetDataDir, entry.name), { recursive: entry.isDirectory() });
    reportProgress(onProgress, ((index + 1) / Math.max(entries.length, 1)) * 100, `正在复制数据文件（${index + 1}/${entries.length}）...`);
  }
}

module.exports = { createDatabaseSnapshot, copyDataFilesForBackup };
