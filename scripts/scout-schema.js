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
  db.exec("CREATE TRIGGER IF NOT EXISTS Scout_progress_delete AFTER DELETE ON ScoutWishCard BEGIN UPDATE CollectionPlan SET status='planned', updatedAt=CAST(strftime('%s','now') AS INTEGER)*1000 WHERE id=OLD.planId AND status='acquired' AND EXISTS(SELECT 1 FROM ScoutWishDetails d WHERE d.planId=OLD.planId AND d.targetCount > (SELECT COUNT(*) FROM ScoutWishCard WHERE planId=OLD.planId)); END;");
}
function createWishCardSchema(db) {
  db.exec("CREATE TABLE ScoutWishCard(planId TEXT NOT NULL REFERENCES CollectionPlan(id) ON DELETE CASCADE, cardId TEXT NOT NULL REFERENCES Card(id) ON DELETE CASCADE, PRIMARY KEY(planId,cardId)); CREATE INDEX ScoutWishCard_cardId_idx ON ScoutWishCard(cardId);");
}
module.exports = { scoutTables, createScoutSchema };
