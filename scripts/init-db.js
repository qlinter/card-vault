const path = require("node:path");
const { initializeDatabase } = require("./database-schema");
const { generateHomeThumbnails } = require("./generate-home-thumbnails");
const { resolveDbPath } = require("./storage-paths");

const rootDir = path.resolve(__dirname, "..");

async function main() {
  const result = initializeDatabase(resolveDbPath(rootDir));

  console.log(`Database ready: ${result.dbPath} (${result.schemaVersion})`);
  if (result.upgraded) {
    console.log(`Upgrade snapshot: ${result.backupPath}`);
    if (result.expenseBackfill) {
      console.log(`Expense associations updated: ${result.expenseBackfill.expenseBackfillCount} (purchase shipping ${result.expenseBackfill.purchaseShippingCount}, grading shipping ${result.expenseBackfill.gradingShippingCount})`);
    }
  }

  try {
    const thumbnails = await generateHomeThumbnails({ projectRoot: rootDir });
    console.log(`Home thumbnails ready: ${thumbnails.total} (${thumbnails.generated} generated, ${thumbnails.cached} cached, ${thumbnails.failed} failed)`);
  } catch (error) {
    console.warn(`Home thumbnail warm-up skipped: ${error instanceof Error ? error.message : error}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
