const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const { initializeDatabase } = require("./database-schema");
const { checkPackagedDesktop } = require("./test-packaged-desktop-utils");

async function main() {
  const root = path.resolve(__dirname, "..");
  const executable = path.resolve(process.argv[2] || path.join(root, "dist", "win-unpacked", "Card Vault.exe"));
  assert.ok(fs.existsSync(executable), "Packaged executable is missing.");
  const logDir = path.join(root, "logs", `v${require("../package.json").version}-review`);
  const userData = path.join(logDir, "packaged-desktop-profile");
  const dataDir = path.join(userData, "data");
  const dbPath = path.join(dataDir, "dev.db");
  initializeDatabase(dbPath);
  fs.mkdirSync(path.join(dataDir, "uploads"), { recursive: true });
  await require("sharp")({ create: { width: 800, height: 1200, channels: 3, background: "#123456" } }).png().toFile(path.join(dataDir, "uploads", "native-fixture.png"));
  const db = new DatabaseSync(dbPath);
  try {
    assert.equal(db.prepare("SELECT COUNT(*) n FROM Card WHERE id<>'native-fixture'").get().n, 0, "Unexpected collection in desktop fixture profile.");
    if (!db.prepare("SELECT 1 FROM Card WHERE id='native-fixture'").get()) {
      const now = "2026-10-10T00:00:00.000Z";
      db.prepare("INSERT INTO Card(id,playerName,cardTitle,sport,holdingQuantity,createdAt,updatedAt) VALUES('native-fixture','Native Fixture','Packaged desktop fixture','Basketball',1,?,?)").run(now, now);
      db.prepare("INSERT INTO CardTransaction(id,cardId,kind,amountMinor,currency,quantity,occurredAt,provenance,createdAt,updatedAt) VALUES('native-buy','native-fixture','purchase',10000,'CNY',1,?,'acceptance',?,?)").run(now, now, now);
      db.prepare("INSERT INTO CardValuation(id,cardId,amountMinor,currency,valuedAt,source,provenance,createdAt,updatedAt) VALUES('native-quote','native-fixture',12000,'CNY',?,'eBay','acceptance',?,?)").run(now, now, now);
    }
    db.prepare("INSERT OR IGNORE INTO CardImage(id,cardId,path,createdAt) VALUES('native-image','native-fixture','/media/native-fixture.png','2026-10-10T00:00:00.000Z')").run();
  } finally { db.close(); }
  const env = { ...process.env, CARD_VAULT_USER_DATA_DIR: userData, CARD_VAULT_ACCEPTANCE_MODE: "1" };
  delete env.ELECTRON_RUN_AS_NODE;
  const version = require(path.join(path.dirname(executable), "resources", "app", "package.json")).version;
  await checkPackagedDesktop(executable, version, { env, userData, playerName: "Native Fixture", query: "Native" });
  const result = { testedAt: new Date().toISOString(), version, executable, checks: ["packaged-desktop-startup", "sandbox-and-preload", "saved-edit-back-to-filter", "repeated-cancel-back-to-filter"], ok: true };
  fs.writeFileSync(path.join(logDir, "packaged-desktop.json"), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
