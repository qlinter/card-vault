const fs = require("node:fs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { DatabaseSync } = require("node:sqlite");
const { validateCurrentSchema } = require("./database-schema");
const { createDatabaseSnapshot } = require("../electron/storage/database-snapshot");

/** Shared transaction and safety-copy boundary for the authorized v1.5 resets. */
function resetHistory(dbPath, { version, previousVersion, tables, recoveryDirectory, missingMessage, versionMessage }) {
  if (!fs.existsSync(dbPath)) throw new Error(missingMessage);
  const db = new DatabaseSync(dbPath);
  let active = false;
  const unchanged = () => ({ changed: false, counts: {}, backupPath: null });
  try {
    db.exec("PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON");
    if (db.prepare("PRAGMA user_version").get().user_version >= version) return unchanged();
    db.exec("BEGIN IMMEDIATE");
    active = true;
    const currentVersion = db.prepare("PRAGMA user_version").get().user_version;
    if (currentVersion >= version) { db.exec("COMMIT"); active = false; return unchanged(); }
    if (currentVersion !== previousVersion) throw new Error(versionMessage);
    validateCurrentSchema(db);
    const counts = Object.fromEntries(tables.map(table => [table, db.prepare(`SELECT count(*) count FROM ${table}`).get().count]));
    let backupPath = null;
    if (Object.values(counts).some(count => count > 0)) {
      const directory = path.join(path.dirname(dbPath), ".recovery", recoveryDirectory);
      fs.mkdirSync(directory, { recursive: true });
      backupPath = path.join(directory, `${Date.now()}-${randomUUID()}.db`);
      createDatabaseSnapshot(dbPath, backupPath);
    }
    for (const table of tables) db.exec(`DELETE FROM ${table}`);
    db.exec(`PRAGMA user_version=${version}; COMMIT`);
    active = false;
    return { changed: true, counts, backupPath };
  } finally { if (active) db.exec("ROLLBACK"); db.close(); }
}

module.exports = { resetHistory };
