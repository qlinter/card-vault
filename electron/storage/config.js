const path = require("node:path");
const { resolveDbPath, resolveShareBackgroundsDir, resolveShareCoversDir, resolveUploadsDir } = require("../../scripts/storage-paths");
const { clearFile, isSubPath, loadJson, pathsEqual, saveJson } = require("./file-utils");
const { repairDataLayout: repairLayout } = require("./layout");

function createStorageConfig({ appDataRoot, projectRoot }) {
  const storageConfigPath = path.join(appDataRoot, "storage-config.json");
  const cleanupConfigPath = path.join(appDataRoot, "cleanup-config.json");
  const loadStorageConfig = () => loadJson(storageConfigPath);
  const loadCleanupConfig = () => loadJson(cleanupConfigPath);
  const getDataDir = () => loadStorageConfig().dataDir || path.join(appDataRoot, "data");
  const getBackupDir = () => loadStorageConfig().backupDir || path.join(appDataRoot, "backups");
  const getUploadsDir = () => resolveUploadsDir(projectRoot, { CARD_VAULT_DATA_DIR: getDataDir() });
  const getShareCoversDir = () => resolveShareCoversDir(projectRoot, { CARD_VAULT_DATA_DIR: getDataDir() });
  const getShareBackgroundsDir = () => resolveShareBackgroundsDir(projectRoot, { CARD_VAULT_DATA_DIR: getDataDir() });
  const getDbPath = () => resolveDbPath(projectRoot, { CARD_VAULT_DATA_DIR: getDataDir(), CARD_VAULT_DB_PATH: process.env.CARD_VAULT_DB_PATH });
  const getEnv = () => ({ CARD_VAULT_DATA_DIR: getDataDir(), CARD_VAULT_DB_PATH: getDbPath(), CARD_VAULT_STORAGE_CONFIG_PATH: storageConfigPath });
  const saveStorageConfig = (dataDir) => saveJson(storageConfigPath, { ...loadStorageConfig(), dataDir });
  const saveBackupConfig = (backupDir) => saveJson(storageConfigPath, { ...loadStorageConfig(), backupDir });
  const clearCleanupConfig = () => clearFile(cleanupConfigPath);
  const validateBackupDir = (backupDir) => {
    const dataDir = path.resolve(getDataDir());
    const resolvedBackupDir = path.resolve(backupDir);
    if (pathsEqual(dataDir, resolvedBackupDir) || isSubPath(dataDir, resolvedBackupDir)) throw new Error("Backup path cannot be inside the current data folder.");
  };
  const repairDataLayout = (dataDir) => repairLayout(dataDir);
  return { storageConfigPath, cleanupConfigPath, loadStorageConfig, loadCleanupConfig, getDataDir, getBackupDir, getUploadsDir, getShareCoversDir, getShareBackgroundsDir, getDbPath, getEnv, saveStorageConfig, saveBackupConfig, clearCleanupConfig, validateBackupDir, repairDataLayout };
}

module.exports = { createStorageConfig };
