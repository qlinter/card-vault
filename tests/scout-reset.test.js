const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { DatabaseSync } = require("node:sqlite");
const { initializeDatabase } = require("../scripts/database-schema");
const { resetScoutHistory, scoutResetVersion } = require("../scripts/reset-scout-history");
const { createDatabaseSnapshot } = require("../electron/storage/database-snapshot");

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "vault-scout-reset-"));
  const file = path.join(root, "dev.db");
  initializeDatabase(file);
  const db = new DatabaseSync(file);
  t.after(() => { db.close(); fs.rmSync(root, { recursive: true, force: true }); });
  return { file, db };
}
test("scout reset deletes only authorized history, preserves schema and unrelated records, and keeps a safety copy", t => {
  const { file, db } = fixture(t);
  db.exec("PRAGMA foreign_keys=ON; INSERT INTO Card(id,playerName,cardTitle,sport) VALUES('card','Player','Card','Basketball'); INSERT INTO CardValuation(id,cardId,amountMinor,currency,valuedAt,source,provenance) VALUES('value','card',12345,'CNY','2026-01-01','个人估计','manual'); INSERT INTO CollectionPlan(id,title) VALUES('old-wish','Old wish'); INSERT INTO ScoutWatch(id,title,queryJson) VALUES('watch','Old keyword','{}'); INSERT INTO ScoutWishDetails(planId,priority,targetCount) VALUES('old-wish',1,3); INSERT INTO ScoutWishWatch(planId,watchId) VALUES('old-wish','watch'); INSERT INTO ScoutWishCard(planId,cardId) VALUES('old-wish','card')");
  const schema = db.prepare("SELECT sql FROM sqlite_master ORDER BY name").all();
  const excluded = new Set(["CollectionPlan","ScoutWatch","ScoutWishDetails","ScoutWishWatch","ScoutWishCard"]);
  const names = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all().map(row => row.name).filter(name => !excluded.has(name));
  const before = Object.fromEntries(names.map(name => [name, db.prepare('SELECT * FROM "' + name + '" ORDER BY rowid').all()]));
  const result = resetScoutHistory(file);
  assert.equal(result.changed, true);
  assert.deepEqual(Object.values(result.counts), [1,1,1,1,1]);
  for (const table of excluded) assert.equal(db.prepare("SELECT count(*) n FROM " + table).get().n, 0);
  assert.deepEqual(db.prepare("SELECT sql FROM sqlite_master ORDER BY name").all(), schema);
  for (const name of names) assert.deepEqual(db.prepare('SELECT * FROM "' + name + '" ORDER BY rowid').all(), before[name], name);
  assert.equal(db.prepare("PRAGMA user_version").get().user_version, scoutResetVersion);
  const saved = new DatabaseSync(result.backupPath, { readOnly: true });
  try { assert.equal(saved.prepare("SELECT count(*) n FROM CollectionPlan").get().n, 1); } finally { saved.close(); }
  db.exec("INSERT INTO CollectionPlan(id,title) VALUES('new-wish','New wish')");
  assert.equal(resetScoutHistory(file).changed, false);
  assert.equal(db.prepare("SELECT title FROM CollectionPlan").get().title, "New wish");
  const restored = path.join(path.dirname(file), "restored.db");
  createDatabaseSnapshot(file, restored);
  assert.equal(resetScoutHistory(restored).changed, false);
  const copy = new DatabaseSync(restored, { readOnly: true });
  try { assert.equal(copy.prepare("SELECT title FROM CollectionPlan").get().title, "New wish"); } finally { copy.close(); }
});
test("failed reset rolls back the deletion and marker together", t => {
  const { file, db } = fixture(t);
  db.exec("INSERT INTO CollectionPlan(id,title) VALUES('old-wish','Old wish'); CREATE TRIGGER fail_scout_reset BEFORE DELETE ON ScoutWatch BEGIN SELECT RAISE(ABORT,'fixture failure'); END; INSERT INTO ScoutWatch(id,title,queryJson) VALUES('watch','keyword','{}')");
  assert.throws(() => resetScoutHistory(file), /fixture failure/);
  assert.equal(db.prepare("SELECT count(*) n FROM CollectionPlan").get().n, 1);
  assert.equal(db.prepare("PRAGMA user_version").get().user_version, 0);
});
