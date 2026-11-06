const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"), os = require("node:os"), path = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const { initializeDatabase } = require("../scripts/database-schema");

test("current target progress reacts to card deletion and enforces valid quantities", t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "vault-scout-current-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const file = path.join(root, "dev.db"); initializeDatabase(file);
  const db = new DatabaseSync(file);
  try {
    db.exec("PRAGMA foreign_keys=ON; INSERT INTO Card(id,playerName,cardTitle,sport) VALUES('a','A','A','Basketball'),('b','B','B','Basketball'); INSERT INTO CollectionPlan(id,title,status) VALUES('progress','Set','acquired'); INSERT INTO ScoutWishDetails(planId,priority,targetCount) VALUES('progress',1,2); INSERT INTO ScoutWishCard VALUES('progress','a'),('progress','b'); DELETE FROM Card WHERE id='a'");
    assert.equal(db.prepare("SELECT status FROM CollectionPlan WHERE id='progress'").get().status, "planned");
    assert.equal(db.prepare("SELECT cardId FROM ScoutWishCard").get().cardId, "b");
    for (const count of [0, 501]) assert.throws(() => db.prepare("UPDATE ScoutWishDetails SET targetCount=?").run(count), /CHECK/);
  } finally { db.close(); }
  const before = fs.readFileSync(file);
  initializeDatabase(file);
  assert.deepEqual(fs.readFileSync(file), before);
});
