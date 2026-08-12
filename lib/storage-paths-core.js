const path = require("node:path");

const dataDirectoryName = "data";
const databaseDirectoryName = "prisma";
const databaseFileName = "dev.db";
const uploadsDirectoryName = "uploads";
const shareCoversDirectoryName = "share-covers";
const shareBackgroundsDirectoryName = "share-backgrounds";

function valueFromEnv(env, key) {
  const value = env?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function projectRootPath(projectRoot = process.cwd()) {
  return path.resolve(projectRoot);
}

function resolveDataDir(projectRoot = process.cwd(), env = process.env) {
  return valueFromEnv(env, "CARD_VAULT_DATA_DIR") || path.join(projectRootPath(projectRoot), dataDirectoryName);
}

function resolveDbPath(projectRoot = process.cwd(), env = process.env) {
  const customDbPath = valueFromEnv(env, "CARD_VAULT_DB_PATH");
  if (customDbPath) return customDbPath;

  const customDataDir = valueFromEnv(env, "CARD_VAULT_DATA_DIR");
  if (customDataDir) return path.join(customDataDir, databaseFileName);

  return path.join(projectRootPath(projectRoot), databaseDirectoryName, databaseFileName);
}

function resolveUploadsDir(projectRoot = process.cwd(), env = process.env) {
  return path.join(resolveDataDir(projectRoot, env), uploadsDirectoryName);
}

function resolveShareCoversDir(projectRoot = process.cwd(), env = process.env) {
  return path.join(resolveDataDir(projectRoot, env), shareCoversDirectoryName);
}

function resolveShareBackgroundsDir(projectRoot = process.cwd(), env = process.env) {
  return path.join(resolveDataDir(projectRoot, env), shareBackgroundsDirectoryName);
}

module.exports = {
  resolveDataDir,
  resolveDbPath,
  resolveShareBackgroundsDir,
  resolveShareCoversDir,
  resolveUploadsDir
};
