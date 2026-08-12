const fs = require("node:fs");
const path = require("node:path");

function loadJson(filePath) {
  try { return JSON.parse(fs.readFileSync(filePath, "utf8")); } catch { return {}; }
}

function saveJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
}

function clearFile(filePath) {
  if (fs.existsSync(filePath)) fs.rmSync(filePath, { force: true });
}

function pathsEqual(leftPath, rightPath) { return path.resolve(leftPath) === path.resolve(rightPath); }

function isSubPath(parentPath, childPath) {
  const relativePath = path.relative(parentPath, childPath);
  return relativePath !== "" && !relativePath.startsWith("..") && !path.isAbsolute(relativePath);
}

function resolveSelectedDataDir(selectedPath) {
  const normalizedPath = path.resolve(selectedPath);
  const parsedPath = path.parse(normalizedPath);
  return normalizedPath === parsedPath.root ? path.join(normalizedPath, "QL-card-vault-data") : normalizedPath;
}

function copyFileIfMissing(sourcePath, targetPath) {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  if (!fs.existsSync(targetPath)) fs.copyFileSync(sourcePath, targetPath);
}

function directoryHasEntries(directoryPath) {
  return fs.existsSync(directoryPath) && fs.readdirSync(directoryPath).length > 0;
}

function directoryFiles(directoryPath) {
  if (!fs.existsSync(directoryPath)) return [];
  return fs.readdirSync(directoryPath, { withFileTypes: true }).filter((entry) => entry.isFile()).map((entry) => entry.name);
}

function hasExistingStorageData(dataDir) {
  const databaseNames = ["dev.db", "dev.db-journal", "dev.db-shm", "dev.db-wal"];
  if (databaseNames.some((name) => fs.existsSync(path.join(dataDir, name)))) return true;
  return ["uploads", "share-covers", "share-backgrounds", "schema-backups"].some((directory) => directoryHasEntries(path.join(dataDir, directory)));
}

function flattenNestedUploads(uploadsDir) {
  const nestedUploadsDir = path.join(uploadsDir, "uploads");
  if (!fs.existsSync(nestedUploadsDir)) return;
  for (const entry of fs.readdirSync(nestedUploadsDir, { withFileTypes: true })) {
    if (entry.isFile()) copyFileIfMissing(path.join(nestedUploadsDir, entry.name), path.join(uploadsDir, entry.name));
  }
  fs.rmSync(nestedUploadsDir, { recursive: true, force: true });
}

module.exports = {
  loadJson,
  saveJson,
  clearFile,
  pathsEqual,
  isSubPath,
  resolveSelectedDataDir,
  copyFileIfMissing,
  directoryHasEntries,
  directoryFiles,
  hasExistingStorageData,
  flattenNestedUploads
};
