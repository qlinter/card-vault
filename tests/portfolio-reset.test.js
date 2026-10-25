const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), os = require("node:os");
const { DatabaseSync } = require("node:sqlite");
const { initializeDatabase } = require("../scripts/database-schema");
const { resetScoutHistory } = require("../scripts/reset-scout-history");
const { resetPortfolioHistory, portfolioResetVersion } = require("../scripts/reset-portfolio-history");
const { createDatabaseSnapshot } = require("../electron/storage/database-snapshot");
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "vault-portfolio-reset-")), file = path.join(root,"dev.db");
  initializeDatabase(file); resetScoutHistory(file);
  const db = new DatabaseSync(file);
  t.after(() => { db.close(); fs.rmSync(root, { recursive: true, force: true }); });
  return { file, db };
}
function seed(db) {
  db.exec("PRAGMA foreign_keys=ON; INSERT INTO Card(id,playerName,cardTitle,sport) VALUES('card','Player','Card','Basketball'); INSERT INTO CardValuation(id,cardId,amountMinor,currency,valuedAt,source,provenance) VALUES('value','card',12345,'CNY','2026-01-01','个人估计','manual'); INSERT INTO CollectionPlan(id,title) VALUES('new-wish','New wish'); INSERT INTO PortfolioSavedView(id,name,queryJson) VALUES('view','Old view','invalid'); INSERT INTO PortfolioSnapshotRecord(id,savedViewId,name,queryJson,snapshotJson) VALUES('snapshot','view','Old snapshot','invalid','damaged')");
}
test("analysis history reset removes only retired records and preserves new wishes, cards, finances and schema", t => {
  const {file,db} = fixture(t); seed(db);
  const schema = db.prepare("SELECT type,name,sql FROM sqlite_master ORDER BY name").all();
  const names = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT IN ('PortfolioSavedView','PortfolioSnapshotRecord')").all().map(row=>row.name);
  const before = Object.fromEntries(names.map(name=>[name,db.prepare('SELECT * FROM "'+name+'" ORDER BY rowid').all()]));
  const result = resetPortfolioHistory(file);
  assert.deepEqual(result.counts, { PortfolioSnapshotRecord:1,PortfolioSavedView:1 });
  for(const name of names) assert.deepEqual(db.prepare('SELECT * FROM "'+name+'" ORDER BY rowid').all(), before[name], name);
  assert.deepEqual(db.prepare("SELECT type,name,sql FROM sqlite_master ORDER BY name").all(),schema);
  assert.equal(db.prepare("SELECT count(*) n FROM PortfolioSnapshotRecord").get().n,0);
  assert.equal(db.prepare("SELECT count(*) n FROM PortfolioSavedView").get().n,0);
  assert.equal(db.prepare("PRAGMA user_version").get().user_version,portfolioResetVersion);
  const safety = new DatabaseSync(result.backupPath,{readOnly:true});
  try { assert.equal(safety.prepare("SELECT count(*) n FROM PortfolioSnapshotRecord").get().n,1); } finally { safety.close(); }
  assert.equal(resetScoutHistory(file).changed,false);
  assert.equal(resetPortfolioHistory(file).changed,false);
  const restored = path.join(path.dirname(file),"restored.db"); createDatabaseSnapshot(file,restored);
  assert.equal(resetPortfolioHistory(restored).changed,false);
  const copy = new DatabaseSync(restored,{readOnly:true});
  try { assert.equal(copy.prepare("SELECT title FROM CollectionPlan").get().title,"New wish"); } finally { copy.close(); }
});
test("failed history deletion rolls back snapshot records and the version marker",t=>{
  const {file,db}=fixture(t);seed(db);
  db.exec("CREATE TRIGGER fail_portfolio_reset BEFORE DELETE ON PortfolioSavedView BEGIN SELECT RAISE(ABORT,'fixture failure'); END");
  const before=db.prepare("PRAGMA user_version").get().user_version;
  assert.throws(()=>resetPortfolioHistory(file),/fixture failure/);
  assert.equal(db.prepare("SELECT count(*) n FROM PortfolioSnapshotRecord").get().n,1);
  assert.equal(db.prepare("SELECT count(*) n FROM PortfolioSavedView").get().n,1);
  assert.equal(db.prepare("PRAGMA user_version").get().user_version,before);
});
test("opening Data before Scout applies both authorized resets without clearing later wishes",t=>{
  const {file,db}=fixture(t);seed(db);
  db.exec("PRAGMA user_version=0; INSERT INTO ScoutWatch(id,title,queryJson) VALUES('old-watch','Legacy','{}')");
  resetPortfolioHistory(file);
  assert.equal(db.prepare("SELECT count(*) n FROM ScoutWatch").get().n,0);
  assert.equal(db.prepare("SELECT count(*) n FROM CollectionPlan").get().n,0);
  db.exec("INSERT INTO CollectionPlan(id,title) VALUES('later-wish','Later wish')");
  resetScoutHistory(file); resetPortfolioHistory(file);
  assert.equal(db.prepare("SELECT title FROM CollectionPlan").get().title,"Later wish");
});
