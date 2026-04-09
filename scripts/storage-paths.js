const path = require("node:path");

function getDefaultDataDir(rootDir) {
  return path.join(rootDir, "data");
}

function getDefaultDbPath(rootDir) {
  return path.join(rootDir, "prisma", "dev.db");
}

function resolveDataDir(rootDir, env = process.env) {
  return env.CARD_VAULT_DATA_DIR?.trim() || getDefaultDataDir(rootDir);
}

function resolveDbPath(rootDir, env = process.env) {
  const customDbPath = env.CARD_VAULT_DB_PATH?.trim();
  if (customDbPath) {
    return customDbPath;
  }

  const customDataDir = env.CARD_VAULT_DATA_DIR?.trim();
  if (customDataDir) {
    return path.join(customDataDir, "dev.db");
  }

  return getDefaultDbPath(rootDir);
}

function resolveUploadsDir(rootDir, env = process.env) {
  return path.join(resolveDataDir(rootDir, env), "uploads");
}

module.exports = {
  resolveDataDir,
  resolveDbPath,
  resolveUploadsDir
};
