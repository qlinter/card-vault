const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const { initializeDatabase } = require("../scripts/database-schema");

function database(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "card-vault-tracking-"));
  const file = path.join(root, "dev.db");
  initializeDatabase(file);
  const db = new DatabaseSync(file);
  db.exec("PRAGMA foreign_keys=ON");
  t.after(() => { db.close(); fs.rmSync(root, { recursive: true, force: true }); });
  for (const id of ["one", "two", "old"]) db.prepare("INSERT INTO Card(id,playerName,cardTitle,sport,createdAt,updatedAt) VALUES(?, 'A','B','Basketball','2025-01-01','2025-01-01')").run(id);
  return { db, file };
}
const dirty = db => db.prepare("SELECT cardId FROM CardReportDirty ORDER BY cardId").all().map(row => row.cardId);

test("metadata and image changes preserve financial cache; financial facts invalidate only their cards", t => {
  const { db } = database(t);
  db.exec("DELETE FROM CardReportDirty; UPDATE Card SET notes='edit',updatedAt=CURRENT_TIMESTAMP WHERE id='one'; INSERT INTO CardImage(id,cardId,path) VALUES('image','one','/media/example.webp');");
  assert.deepEqual(dirty(db), []);
  db.exec("INSERT INTO CardValuation(id,cardId,amountMinor,currency,valuedAt,source,provenance) VALUES('v','one',100,'CNY','2026-01-01','个人估计','test')");
  assert.deepEqual(dirty(db), ["one"]);
  db.exec("DELETE FROM CardReportDirty; UPDATE CardValuation SET cardId='two' WHERE id='v';");
  assert.deepEqual(dirty(db), ["one", "two"]);
  db.exec("DELETE FROM Card WHERE id='two'");
  assert.deepEqual(dirty(db), ["one"]);
});

test("FX edits invalidate foreign amounts after both the old and new effective dates", t => {
  const { db } = database(t);
  const buy = db.prepare("INSERT INTO CardTransaction(id,cardId,kind,amountMinor,currency,occurredAt,provenance) VALUES(?,?,'purchase',100,?,?,'test')");
  buy.run("local", "one", "CNY", new Date("2026-03-01").getTime());
  buy.run("foreign", "two", "USD", new Date("2026-03-01").getTime());
  buy.run("past", "old", "USD", "2025-01-01");
  db.exec("DELETE FROM CardReportDirty; INSERT INTO ExchangeRate(id,effectiveDate,rateMicros,source,revision) VALUES('fx','2026-02-01',7000000,'test',1)");
  assert.deepEqual(dirty(db), ["two"]);
  db.exec("DELETE FROM CardReportDirty; UPDATE ExchangeRate SET effectiveDate='2024-01-01' WHERE id='fx'");
  assert.deepEqual(dirty(db), ["old", "two"]);
  db.exec("DELETE FROM CardReportDirty; DELETE FROM ExchangeRate");
  assert.deepEqual(dirty(db), ["old", "two"]);
  db.exec("DELETE FROM CardReportDirty; INSERT INTO FinancialSettings(id,reportingCurrency) VALUES('default','USD')");
  assert.deepEqual(dirty(db), ["old", "one", "two"]);
});

test("status dates and evidence revisions survive unrelated edits, reinitialization and transaction rollback", t => {
  const { db, file } = database(t);
  const tracking = () => ({ ...db.prepare("SELECT * FROM CardTracking WHERE cardId='one'").get() });
  const original = tracking();
  db.exec("UPDATE Card SET notes='new',updatedAt='2026-09-08' WHERE id='one'");
  assert.deepEqual(tracking(), original);
  db.exec("UPDATE Card SET collectionStatus='listed' WHERE id='one'");
  assert.equal(tracking().statusRevision, 1);
  assert.notEqual(tracking().statusStartedAt, original.statusStartedAt);
  db.exec("INSERT INTO CardImage(id,cardId,path) VALUES('image','one','/media/example.webp'); DELETE FROM CardImage WHERE id='image'");
  assert.equal(tracking().imagesRevision, 2);
  const before = tracking();
  db.exec("BEGIN; UPDATE Card SET collectionStatus='holding' WHERE id='one'; ROLLBACK");
  assert.deepEqual(tracking(), before);
  initializeDatabase(file);
  assert.deepEqual(tracking(), before);
});
