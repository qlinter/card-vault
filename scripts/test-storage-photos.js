const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { DatabaseSync } = require("node:sqlite");
const { initializeDatabase } = require("./database-schema");
const { createStorageManager } = require("../electron/storage");
const { sha256File } = require("../lib/file-hash");

function main() {
  const source = path.resolve(process.argv[2] || "");
  assert.ok(process.argv[2] && fs.statSync(source).isDirectory(), "Pass a read-only photo directory for large-photo acceptance.");
  const photos = fs.readdirSync(source).filter(name => /\.(jpe?g|png|webp)$/i.test(name)).map(name => ({ file: path.join(source, name), bytes: fs.statSync(path.join(source, name)).size })).sort((a, b) => b.bytes - a.bytes).slice(0, 5);
  assert.ok(photos.length > 0 && photos[0].bytes > 1024 * 1024, "Acceptance requires at least one real photo larger than 1 MiB.");
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "card-vault-photo-storage-"));
  const profile = path.join(root, "profile"), data = path.join(profile, "data");
  const storage = createStorageManager({ appDataRoot: profile, projectRoot: path.resolve(__dirname, "..") });
  try {
    initializeDatabase(path.join(data, "dev.db")); storage.ensureDataLayout(data);
    const db = new DatabaseSync(path.join(data, "dev.db"));
    db.exec("INSERT INTO Card(id,playerName,cardTitle,sport) VALUES('photo','Photo acceptance','Private local fixture','Basketball')");
    const hashes = photos.map((photo, index) => {
      const name = `photo-${index}${path.extname(photo.file)}`;
      fs.copyFileSync(photo.file, path.join(data, "uploads", name));
      db.prepare("INSERT INTO CardImage(id,cardId,path) VALUES(?,'photo',?)").run(String(index), `/media/${name}`);
      return { name, hash: sha256File(photo.file), bytes: photo.bytes };
    }); db.close();
    const backup = storage.backupDataFolder();
    for (const photo of hashes) assert.equal(sha256File(path.join(backup.backupPath, "uploads", photo.name)), photo.hash);
    storage.restoreDataFolder(backup.backupPath);
    for (const photo of hashes) assert.equal(sha256File(path.join(data, "uploads", photo.name)), photo.hash);
    const originalCopy = fs.cpSync;
    try {
      fs.cpSync = (from, to, options) => { if (String(to).includes("restore-staging")) throw Object.assign(new Error("simulated full disk while copying photos"), { code: "ENOSPC" }); return originalCopy(from, to, options); };
      assert.throws(() => storage.restoreDataFolder(backup.backupPath), /full disk/);
    } finally { fs.cpSync = originalCopy; }
    for (const photo of hashes) assert.equal(sha256File(path.join(data, "uploads", photo.name)), photo.hash);
    assert.equal(storage.inspectDataFolder().integrity, "ok");
    const report = { testedAt: new Date().toISOString(), realPhotos: hashes.length, totalPhotoBytes: hashes.reduce((sum, photo) => sum + photo.bytes, 0), largestPhotoBytes: photos[0].bytes, backup: true, restore: true, diskFullPreservesOriginal: true, sourceHashesUnchanged: photos.every((photo, index) => sha256File(photo.file) === hashes[index].hash) };
    const destination = path.resolve("logs", `v${require("../package.json").version}-review`, "storage-photos.json");
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, JSON.stringify(report, null, 2));
    process.stdout.write(JSON.stringify(report) + "\n");
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
}
main();
