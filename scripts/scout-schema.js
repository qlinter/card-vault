const scoutTables = {
  ScoutWatch: ['id','title','queryJson','createdAt','updatedAt'],
  ScoutWishDetails: ['planId','priority','targetCount'],
  ScoutWishWatch: ['planId','watchId'],
  ScoutWishCard: ['planId','cardId']
};
function createScoutSchema(db) {
  db.exec(
    "CREATE TABLE ScoutWatch(id TEXT PRIMARY KEY NOT NULL, title TEXT NOT NULL, queryJson TEXT NOT NULL, createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP);" +
    "CREATE TRIGGER Scout_card_delete BEFORE DELETE ON Card BEGIN UPDATE CollectionPlan SET cardId=NULL WHERE cardId=OLD.id; END;" +
    "CREATE TABLE ScoutWishDetails(planId TEXT PRIMARY KEY NOT NULL REFERENCES CollectionPlan(id) ON DELETE CASCADE, priority INTEGER NOT NULL DEFAULT 2 CHECK(priority BETWEEN 1 AND 3), targetCount INTEGER CHECK(targetCount BETWEEN 1 AND 500));" +
    "CREATE TABLE ScoutWishWatch(planId TEXT NOT NULL REFERENCES CollectionPlan(id) ON DELETE CASCADE, watchId TEXT NOT NULL REFERENCES ScoutWatch(id) ON DELETE CASCADE, PRIMARY KEY(planId,watchId));"
  );
  createWishCardSchema(db);
  createWishProgressSchema(db);
}
function createWishProgressSchema(db) {
  if (!db.prepare('PRAGMA table_info(ScoutWishDetails)').all().some(row => row.name === 'targetCount')) db.exec('ALTER TABLE ScoutWishDetails ADD COLUMN targetCount INTEGER CHECK(targetCount BETWEEN 1 AND 500)');
  db.exec("CREATE TRIGGER IF NOT EXISTS Scout_progress_delete AFTER DELETE ON ScoutWishCard BEGIN UPDATE CollectionPlan SET status='planned', updatedAt=CAST(strftime('%s','now') AS INTEGER)*1000 WHERE id=OLD.planId AND status='acquired' AND EXISTS(SELECT 1 FROM ScoutWishDetails d WHERE d.planId=OLD.planId AND d.targetCount > (SELECT COUNT(*) FROM ScoutWishCard WHERE planId=OLD.planId)); END;");
}
function createWishCardSchema(db) {
  db.exec("CREATE TABLE ScoutWishCard(planId TEXT NOT NULL REFERENCES CollectionPlan(id) ON DELETE CASCADE, cardId TEXT NOT NULL REFERENCES Card(id) ON DELETE CASCADE, PRIMARY KEY(planId,cardId)); CREATE INDEX ScoutWishCard_cardId_idx ON ScoutWishCard(cardId);");
  // Convert only once; subsequent deletion of a link must not recreate the old binding.
  db.exec("INSERT INTO ScoutWishCard(planId,cardId) SELECT p.id,p.cardId FROM CollectionPlan p JOIN Card c ON c.id=p.cardId; UPDATE CollectionPlan SET cardId=NULL WHERE cardId IS NOT NULL;");
}
// Remove discarded development tables and fields rather than retaining a hidden research feature.
const removedColumns = { ScoutWatch: ['queryVersion','status','pinned','tags','notes','cardId','lastOpenedAt'], ScoutWishDetails: ['paused'] };
function scoutSchemaNeedsCleanup(db) {
  if (db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name IN ('ScoutItem','ScoutObservation')").get()) return true;
  return Object.entries(removedColumns).some(([table, columns]) => {
    const stored = new Set(db.prepare("PRAGMA table_info(" + table + ")").all().map(row => row.name));
    return columns.some(column => stored.has(column));
  });
}
function cleanupScoutSchema(db) {
  db.exec("DROP TABLE IF EXISTS ScoutObservation; DROP TABLE IF EXISTS ScoutItem; DROP INDEX IF EXISTS ScoutWatch_status_pinned_idx");
  for (const [table, columns] of Object.entries(removedColumns)) {
    const stored = new Set(db.prepare("PRAGMA table_info(" + table + ")").all().map(row => row.name));
    for (const column of columns) if (stored.has(column)) db.exec("ALTER TABLE " + table + " DROP COLUMN " + column);
  }
  const update = db.prepare("UPDATE ScoutWatch SET title=?,queryJson=? WHERE id=?");
  for (const row of db.prepare("SELECT id,title,queryJson FROM ScoutWatch").all()) {
    const query = JSON.parse(row.queryJson);
    const keyword = typeof query.keyword === "string" && query.keyword.trim() ? query.keyword.trim().replace(/\s+/g, " ") : row.title;
    update.run(keyword, JSON.stringify({ keyword }), row.id);
  }
}
module.exports = { scoutTables, createScoutSchema, createWishCardSchema, createWishProgressSchema, scoutSchemaNeedsCleanup, cleanupScoutSchema };
