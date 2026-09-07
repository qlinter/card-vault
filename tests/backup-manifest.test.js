const fs = require("node:fs"), os = require("node:os"), path = require("node:path"), assert = require("node:assert/strict"), test = require("node:test");
const { DatabaseSync } = require("node:sqlite");
const { writeBackupManifest, verifyBackupManifest } = require("../electron/storage/backup-manifest");
test("backup manifest verifies facts and rejects changed media before restore", t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "card-vault-manifest-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const db = new DatabaseSync(path.join(root, "dev.db")); db.exec("CREATE TABLE Card(id TEXT); INSERT INTO Card VALUES('one');"); db.close();
  fs.writeFileSync(path.join(root, "image.webp"), "original");
  assert.equal(verifyBackupManifest(root).legacy, true);
  const manifest = writeBackupManifest(root); assert.equal(manifest.counts.Card, 1);
  assert.equal(verifyBackupManifest(root).verified, true);
  const manifestPath = path.join(root, "backup-manifest.json");
  for (const counts of [null, {}, { Card: 2 }, { Card: 1, Extra: 0 }]) {
    fs.writeFileSync(manifestPath, JSON.stringify({ ...manifest, counts }));
    assert.throws(() => verifyBackupManifest(root), /记录数量/);
  }
  fs.writeFileSync(manifestPath, JSON.stringify(manifest));
  fs.writeFileSync(path.join(root, "image.webp"), "modified");
  assert.throws(() => verifyBackupManifest(root), /校验失败/);
});
