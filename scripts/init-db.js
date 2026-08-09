const path = require("node:path");
const { initializeDatabase } = require("./database-migrations");
const { resolveDbPath } = require("./storage-paths");

const rootDir = path.resolve(__dirname, "..");
const result = initializeDatabase(resolveDbPath(rootDir));

if (result.backupPath) {
  console.log(`Pre-migration backup: ${result.backupPath}`);
}
if (result.appliedMigrations.length > 0) {
  console.log(`Applied migrations: ${result.appliedMigrations.join(", ")}`);
}
console.log(`Database ready: ${result.dbPath} (${result.schemaVersion})`);
