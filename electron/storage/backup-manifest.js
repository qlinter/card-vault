const { sha256File } = require("../../lib/file-hash");
const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const manifestName = "backup-manifest.json";
function backupFiles(root, relative = "") {
  return fs.readdirSync(path.join(root, relative), { withFileTypes: true }).flatMap(entry => {
    const name = path.join(relative, entry.name);
    if (entry.isSymbolicLink()) throw new Error("备份包含符号链接，已取消。");
    if (entry.isDirectory()) return backupFiles(root, name);
    return name === manifestName ? [] : [name.replaceAll(path.sep, "/")];
  }).sort();
}
function databaseCounts(root) {
  const db = new DatabaseSync(path.join(root, "dev.db"), { readOnly: true });
  try { return Object.fromEntries(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all().map(({ name }) => [name, Number(db.prepare(`SELECT COUNT(*) AS n FROM "${name.replaceAll('"', '""')}"`).get().n)])); }
  finally { db.close(); }
}
function writeBackupManifest(root) {
  const manifest = { version: 1, appVersion: require("../../package.json").version, createdAt: new Date().toISOString(), counts: databaseCounts(root), files: backupFiles(root).map(name => ({ name, bytes: fs.statSync(path.join(root, name)).size, sha256: sha256File(path.join(root, name)) })) };
  fs.writeFileSync(path.join(root, manifestName), JSON.stringify(manifest, null, 2));
  return manifest;
}
function verifyBackupManifest(root) {
  const manifestPath = path.join(root, manifestName);
  if (!fs.existsSync(manifestPath)) return { verified: false, legacy: true, counts: databaseCounts(root) };
  if (fs.statSync(manifestPath).size > 50 * 1024 * 1024) throw new Error("备份清单过大。");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  if (manifest.version !== 1 || !Array.isArray(manifest.files)) throw new Error("备份清单无效。");
  const actual = backupFiles(root);
  const actualNames = new Set(actual);
  if (actual.length !== manifest.files.length || new Set(manifest.files.map(file => file.name)).size !== actual.length) throw new Error("备份文件数量与清单不一致。");
  for (const file of manifest.files) {
    // Membership validation ensures only enumerated, ordinary files inside root are read.
    if (!actualNames.has(file.name) || fs.statSync(path.join(root, file.name)).size !== file.bytes || sha256File(path.join(root, file.name)) !== file.sha256) throw new Error(`备份文件校验失败：${file.name}`);
  }
  const counts = databaseCounts(root);
  if (!manifest.counts || typeof manifest.counts !== "object" || Array.isArray(manifest.counts) || Object.keys(manifest.counts).length !== Object.keys(counts).length) throw new Error("备份记录数量清单不完整。");
  for (const [table, count] of Object.entries(counts)) if (manifest.counts[table] !== count) throw new Error(`备份记录数量不一致：${table}`);
  return { verified: true, legacy: false, counts };
}
module.exports = { writeBackupManifest, verifyBackupManifest, databaseCounts };
