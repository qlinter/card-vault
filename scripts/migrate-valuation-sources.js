const path = require("node:path");
const { validateDatabase } = require("./database-schema");
const { normalizeValuationSourceSchema } = require("./valuation-source-schema");

const database = process.argv[2];
if (!database) throw new Error("Usage: node scripts/migrate-valuation-sources.js <database-path>");
const resolved = path.resolve(database);
validateDatabase(resolved);
const result = normalizeValuationSourceSchema(resolved);
validateDatabase(resolved);
process.stdout.write(JSON.stringify({ database: resolved, ...result }, null, 2) + "\n");
