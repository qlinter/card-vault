const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const { initializeDatabase, upgradeScoutSchema, validateDatabase } = require("../scripts/database-schema");
const { scoutTables } = require("../scripts/scout-schema");
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "vault-scout-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const dbPath = path.join(root, "dev.db"); initializeDatabase(dbPath);
  return dbPath;
}
test("target progress extends an existing Scout database atomically and reacts to card deletion", t => {
  const dbPath = fixture(t), db = new DatabaseSync(dbPath);
  db.exec("DROP TRIGGER Scout_progress_delete; ALTER TABLE ScoutWishDetails DROP COLUMN targetCount; INSERT INTO Card(id,playerName,cardTitle,sport) VALUES('progress-a','A','A','Basketball'),('progress-b','B','B','Basketball'); INSERT INTO CollectionPlan(id,title,status) VALUES('progress','Set','acquired'); INSERT INTO ScoutWishDetails(planId,priority) VALUES('progress',1); INSERT INTO ScoutWishCard VALUES('progress','progress-a'),('progress','progress-b')");
  db.close();
  assert.throws(() => validateDatabase(dbPath), /targetCount/);
  const result = upgradeScoutSchema(dbPath); assert.ok(result.changed); validateDatabase(dbPath);
  const check = new DatabaseSync(dbPath); check.exec("PRAGMA foreign_keys=ON; UPDATE ScoutWishDetails SET targetCount=2; DELETE FROM Card WHERE id='progress-a'");
  assert.equal(check.prepare("SELECT status FROM CollectionPlan WHERE id='progress'").get().status, "planned");
  assert.equal(check.prepare("SELECT cardId FROM ScoutWishCard").get().cardId, "progress-b");
  assert.throws(() => check.exec("UPDATE ScoutWishDetails SET targetCount=501"), /CHECK/);
  check.close(); assert.equal(upgradeScoutSchema(dbPath).changed, false);
});
function removeScout(db) { db.exec("DROP TRIGGER Scout_card_delete; DROP TRIGGER Scout_progress_delete"); for (const table of Object.keys(scoutTables).reverse()) db.exec(`DROP TABLE ${table}`); }
test("complete 1.3 format receives an atomic backed-up extension preserving wishes and reminders", t => {
  const dbPath = fixture(t); const db = new DatabaseSync(dbPath);
  removeScout(db);
  db.exec("INSERT INTO CollectionPlan(id,title,budgetMinor) VALUES('wish','Old wish',0); INSERT INTO CollectionTaskState(id,status,fingerprint) VALUES('task','snoozed','rev1')");
  db.close();
  const before = fs.readFileSync(dbPath);
  validateDatabase(dbPath, { allowPreScout: true }); assert.deepEqual(fs.readFileSync(dbPath), before);
  const result = upgradeScoutSchema(dbPath); assert.equal(result.changed, true); assert.ok(fs.existsSync(result.backupPath));
  const backup = new DatabaseSync(result.backupPath, { readOnly: true });
  assert.equal(backup.prepare("SELECT COUNT(*) n FROM sqlite_master WHERE name='ScoutWatch'").get().n, 0);
  assert.equal(backup.prepare("SELECT title FROM CollectionPlan").get().title, "Old wish"); backup.close();
  const check = new DatabaseSync(dbPath); assert.equal(check.prepare("SELECT budgetMinor FROM CollectionPlan").get().budgetMinor, 0); assert.equal(check.prepare("SELECT status FROM CollectionTaskState").get().status, "snoozed"); check.close();
  const current = fs.readFileSync(dbPath); assert.equal(upgradeScoutSchema(dbPath).changed, false); assert.deepEqual(fs.readFileSync(dbPath), current);
});

for (const preScout of [false, true]) test(`backup restore retains keywords and wishes or extends the staging copy only (${preScout})`, t => {
  const dbPath = fixture(t), source = path.dirname(dbPath), target = path.join(source, "../", path.basename(source) + "-restored");
  t.after(() => fs.rmSync(target, { recursive: true, force: true }));
  const db = new DatabaseSync(dbPath);
  db.exec("INSERT INTO CollectionPlan(id,title) VALUES('p','Saved wish')");
  db.exec("INSERT INTO Card(id,playerName,cardTitle,sport) VALUES('one','Subject','First card','Basketball'),('two','Subject','Second card','Basketball'); UPDATE CollectionPlan SET status='acquired' WHERE id='p'");
  if (preScout) { removeScout(db); db.exec("UPDATE CollectionPlan SET cardId='one' WHERE id='p'"); }
  else db.exec("INSERT INTO ScoutWatch(id,title,queryJson) VALUES('w','Saved query','{}'); INSERT INTO ScoutWishDetails(planId,priority) VALUES('p',1); INSERT INTO ScoutWishWatch VALUES('p','w'); INSERT INTO ScoutWishCard VALUES('p','one'),('p','two');");
  db.close();
  require("../electron/storage/backup-manifest").writeBackupManifest(source);
  const original = fs.readFileSync(dbPath);
  const { createRestoreService } = require("../electron/storage/restore");
  createRestoreService({ config: { getDataDir: () => target, getDbPath: () => path.join(target, "dev.db"), getBackupDir: () => path.join(target, "backups") }, backupDataFolder: () => ({ backupPath: "unused" }), ensureDataLayout: () => {} }).restoreDataFolder(source);
  assert.deepEqual(fs.readFileSync(dbPath), original);
  validateDatabase(path.join(target, "dev.db"));
  const restored = new DatabaseSync(path.join(target, "dev.db"));
  assert.equal(restored.prepare("SELECT title FROM CollectionPlan").get().title, "Saved wish");
  assert.equal(restored.prepare("SELECT COUNT(*) n FROM ScoutWatch").get().n, preScout ? 0 : 1);
  assert.deepEqual(restored.prepare("SELECT cardId FROM ScoutWishCard ORDER BY cardId").all().map(row => row.cardId), preScout ? ["one"] : ["one", "two"]);
  if (!preScout) { assert.equal(restored.prepare("SELECT watchId FROM ScoutWishWatch").get().watchId, "w"); }
  restored.close();
});
test("partial scout schema and damaged old schema fail without mutation", t => {
  const dbPath = fixture(t); let db = new DatabaseSync(dbPath); db.exec("DROP TABLE ScoutWishWatch"); db.close();
  let before = fs.readFileSync(dbPath); assert.throws(() => upgradeScoutSchema(dbPath)); assert.deepEqual(fs.readFileSync(dbPath), before);
  db = new DatabaseSync(dbPath); db.exec("DROP TABLE ScoutWishDetails; DROP TABLE ScoutWatch; DROP TRIGGER Scout_card_delete; DROP TRIGGER Scout_progress_delete; DROP INDEX Card_createdAt_idx"); db.close();
  before = fs.readFileSync(dbPath); assert.throws(() => upgradeScoutSchema(dbPath)); assert.deepEqual(fs.readFileSync(dbPath), before);
});
test("keywords link only to wishes and deleting either side preserves cards and finances", t => {
  const dbPath = fixture(t); const db = new DatabaseSync(dbPath); db.exec("PRAGMA foreign_keys=ON");
  db.exec("INSERT INTO ScoutWatch(id,title,queryJson) VALUES('w','Search','{\"keyword\":\"Search\"}'); INSERT INTO CollectionPlan(id,title) VALUES('p','Wish'); INSERT INTO ScoutWishDetails(planId) VALUES('p'); INSERT INTO ScoutWishWatch VALUES('p','w')");
  assert.deepEqual(db.prepare("PRAGMA table_info(ScoutWatch)").all().map(row => row.name), ['id','title','queryJson','createdAt','updatedAt']);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM sqlite_master WHERE name IN ('ScoutItem','ScoutObservation')").get().n, 0);
  db.exec("INSERT INTO Card(id,playerName,cardTitle,sport) VALUES('c','Subject','Card','Basketball'); UPDATE CollectionPlan SET status='acquired'; INSERT INTO ScoutWishCard VALUES('p','c'); DELETE FROM Card WHERE id='c'");
  assert.equal(db.prepare("SELECT COUNT(*) n FROM ScoutWishCard").get().n, 0);
  assert.equal(db.prepare("SELECT status FROM CollectionPlan").get().status, "acquired");
  db.exec("DELETE FROM ScoutWatch WHERE id='w'");
  assert.equal(db.prepare("SELECT COUNT(*) n FROM ScoutWishWatch").get().n, 0);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM CollectionPlan").get().n, 1);
  db.close();
});
test("single-card Scout databases extend atomically to multiple bindings without recreating deleted links", t => {
  const dbPath = fixture(t), db = new DatabaseSync(dbPath);
  db.exec("DROP TABLE ScoutWishCard; INSERT INTO Card(id,playerName,cardTitle,sport) VALUES('c','Subject','Card','Basketball'); INSERT INTO CollectionPlan(id,title,status,cardId,budgetMinor,notes) VALUES('p','Wish','acquired','c',12345,'Keep note'),('missing','Orphan','acquired','deleted',NULL,NULL);");
  db.close();
  const result = upgradeScoutSchema(dbPath); assert.equal(result.changed, true);
  const backup = new DatabaseSync(result.backupPath, { readOnly: true });
  assert.equal(backup.prepare("SELECT cardId FROM CollectionPlan WHERE id='p'").get().cardId, "c"); backup.close();
  const check = new DatabaseSync(dbPath); check.exec("PRAGMA foreign_keys=ON");
  assert.equal(check.prepare("SELECT cardId FROM ScoutWishCard WHERE planId='p'").get().cardId, "c");
  assert.equal(check.prepare("SELECT cardId FROM CollectionPlan WHERE id='p'").get().cardId, null);
  assert.equal(check.prepare("SELECT budgetMinor FROM CollectionPlan WHERE id='p'").get().budgetMinor, 12345);
  assert.equal(check.prepare("SELECT status FROM CollectionPlan WHERE id='missing'").get().status, "acquired");
  check.exec("INSERT INTO Card(id,playerName,cardTitle,sport) VALUES('d','Subject','Second card','Basketball'); INSERT INTO ScoutWishCard VALUES('p','d'); DELETE FROM Card WHERE id='c'");
  assert.deepEqual(check.prepare("SELECT cardId FROM ScoutWishCard WHERE planId='p'").all().map(row => row.cardId), ["d"]);
  assert.throws(() => check.exec("INSERT INTO ScoutWishCard VALUES('p','d')"), /UNIQUE/);
  check.close(); assert.equal(upgradeScoutSchema(dbPath).changed, false);
  const final = new DatabaseSync(dbPath); final.exec("PRAGMA foreign_keys=ON; DELETE FROM CollectionPlan WHERE id='p'");
  assert.equal(final.prepare("SELECT COUNT(*) n FROM ScoutWishCard").get().n, 0);
  assert.equal(final.prepare("SELECT COUNT(*) n FROM Card WHERE id='d'").get().n, 1); final.close();
});
test("discarded development research tables and fields are removed while keyword and wish links survive", t => {
  const dbPath = fixture(t); const db = new DatabaseSync(dbPath); db.exec("PRAGMA foreign_keys=ON");
  db.exec("INSERT INTO Card(id,playerName,cardTitle,sport) VALUES('c','Subject','Card','Basketball'); INSERT INTO CollectionPlan(id,title,budgetMinor) VALUES('p','Wish',12345); INSERT INTO ScoutWatch(id,title,queryJson) VALUES('w','Search','{\"keyword\":\"Search\",\"subject\":\"Discarded metadata\"}'); INSERT INTO ScoutWishWatch VALUES('p','w')");
  db.exec("ALTER TABLE ScoutWatch ADD COLUMN queryVersion INTEGER DEFAULT 1; ALTER TABLE ScoutWatch ADD COLUMN status TEXT DEFAULT 'active'; ALTER TABLE ScoutWatch ADD COLUMN pinned BOOLEAN DEFAULT 0; ALTER TABLE ScoutWatch ADD COLUMN tags TEXT; ALTER TABLE ScoutWatch ADD COLUMN notes TEXT; ALTER TABLE ScoutWatch ADD COLUMN cardId TEXT REFERENCES Card(id); ALTER TABLE ScoutWatch ADD COLUMN lastOpenedAt DATETIME; ALTER TABLE ScoutWishDetails ADD COLUMN paused BOOLEAN DEFAULT 0; CREATE INDEX ScoutWatch_status_pinned_idx ON ScoutWatch(status,pinned); CREATE TABLE ScoutItem(id TEXT PRIMARY KEY,watchId TEXT REFERENCES ScoutWatch(id)); CREATE TABLE ScoutObservation(id TEXT PRIMARY KEY,watchId TEXT REFERENCES ScoutWatch(id),itemId TEXT REFERENCES ScoutItem(id)); INSERT INTO ScoutItem VALUES('i','w'); INSERT INTO ScoutObservation VALUES('o','w','i')");
  db.close();
  const result = upgradeScoutSchema(dbPath); assert.equal(result.changed, true); assert.ok(fs.existsSync(result.backupPath));
  validateDatabase(dbPath);
  const check = new DatabaseSync(dbPath);
  assert.equal(check.prepare("SELECT COUNT(*) n FROM sqlite_master WHERE name IN ('ScoutItem','ScoutObservation','ScoutWatch_status_pinned_idx')").get().n, 0);
  assert.deepEqual(check.prepare("PRAGMA table_info(ScoutWatch)").all().map(row => row.name), ['id','title','queryJson','createdAt','updatedAt']);
  assert.deepEqual(check.prepare("PRAGMA table_info(ScoutWishDetails)").all().map(row => row.name), ['planId','priority','targetCount']);
  assert.deepEqual(JSON.parse(check.prepare("SELECT queryJson FROM ScoutWatch").get().queryJson), { keyword: "Search" });
  assert.equal(check.prepare("SELECT watchId FROM ScoutWishWatch").get().watchId, "w");
  assert.equal(check.prepare("SELECT budgetMinor FROM CollectionPlan").get().budgetMinor, 12345);
  assert.equal(check.prepare("SELECT playerName FROM Card").get().playerName, "Subject");
  check.close();
  const after = fs.readFileSync(dbPath); assert.equal(upgradeScoutSchema(dbPath).changed, false); assert.deepEqual(fs.readFileSync(dbPath), after);
});
