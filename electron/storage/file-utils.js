const fs = require("node:fs");
const path = require("node:path");
const { writeJsonAtomic } = require("../../lib/atomic-json");

function loadJson(filePath) {
  try { return JSON.parse(fs.readFileSync(filePath, "utf8")); } catch { return {}; }
}

function saveJson(filePath, value) {
  writeJsonAtomic(filePath, value);
}

function pathsEqual(leftPath, rightPath) { return path.relative(path.resolve(leftPath), path.resolve(rightPath)) === ""; }

function isSubPath(parentPath, childPath) {
  const relativePath = path.relative(parentPath, childPath);
  return relativePath !== "" && relativePath !== ".." && !relativePath.startsWith(`..${path.sep}`) && !path.isAbsolute(relativePath);
}

function resolveSelectedDataDir(selectedPath) {
  const normalizedPath = path.resolve(selectedPath);
  const parsedPath = path.parse(normalizedPath);
  return normalizedPath === parsedPath.root ? path.join(normalizedPath, "QL-card-vault-data") : normalizedPath;
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
  return ["uploads", "share-covers", "share-backgrounds", "entry-queue", "schema-backups"].some((directory) => directoryHasEntries(path.join(dataDir, directory)));
}

module.exports = {
  loadJson,
  saveJson,
  pathsEqual,
  isSubPath,
  resolveSelectedDataDir,
  directoryHasEntries,
  directoryFiles,
  hasExistingStorageData
};
