const path = require("node:path");
const { resolveDbPath, resolveShareBackgroundsDir, resolveShareCoversDir, resolveThumbnailsDir, resolveUploadsDir } = require("../../lib/storage-paths-core.js");
const { isSubPath, loadJson, pathsEqual, saveJson } = require("./file-utils");
const { ensureDataLayout } = require("./layout");

function createStorageConfig({ appDataRoot, projectRoot }) {
  const storageConfigPath = path.join(appDataRoot, "storage-config.json");
  const loadStorageConfig = () => loadJson(storageConfigPath);
  const validateDataDir = (directory) => {
    if (pathsEqual(directory, appDataRoot) || isSubPath(directory, appDataRoot)) throw new Error("收藏目录不能包含应用配置目录，请选择独立的数据文件夹，以免备份或恢复改动账户。");
    return directory;
  };
  const getDataDir = () => validateDataDir(loadStorageConfig().dataDir || path.join(appDataRoot, "data"));
  const getBackupDir = () => loadStorageConfig().backupDir || path.join(appDataRoot, "backups");
  const getUploadsDir = () => resolveUploadsDir(projectRoot, { CARD_VAULT_DATA_DIR: getDataDir() });
  const getThumbnailsDir = () => resolveThumbnailsDir(projectRoot, { CARD_VAULT_DATA_DIR: getDataDir() });
  const getShareCoversDir = () => resolveShareCoversDir(projectRoot, { CARD_VAULT_DATA_DIR: getDataDir() });
  const getShareBackgroundsDir = () => resolveShareBackgroundsDir(projectRoot, { CARD_VAULT_DATA_DIR: getDataDir() });
  const getDbPath = () => resolveDbPath(projectRoot, { CARD_VAULT_DATA_DIR: getDataDir(), CARD_VAULT_DB_PATH: process.env.CARD_VAULT_DB_PATH });
  const getEnv = () => ({ CARD_VAULT_DATA_DIR: getDataDir(), CARD_VAULT_DB_PATH: getDbPath(), CARD_VAULT_STORAGE_CONFIG_PATH: storageConfigPath });
  const saveStorageConfig = (dataDir) => saveJson(storageConfigPath, { ...loadStorageConfig(), dataDir: validateDataDir(dataDir) });
  const saveBackupConfig = (backupDir) => saveJson(storageConfigPath, { ...loadStorageConfig(), backupDir });
  const saveBackupResult = (lastBackup) => saveJson(storageConfigPath, { ...loadStorageConfig(), lastBackup });
  const validateBackupDir = (backupDir) => {
    const dataDir = path.resolve(getDataDir());
    const resolvedBackupDir = path.resolve(backupDir);
    if (pathsEqual(dataDir, resolvedBackupDir) || isSubPath(dataDir, resolvedBackupDir)) throw new Error("Backup path cannot be inside the current data folder.");
  };
  return { storageConfigPath, loadStorageConfig, getDataDir, getBackupDir, getUploadsDir, getThumbnailsDir, getShareCoversDir, getShareBackgroundsDir, getDbPath, getEnv, saveStorageConfig, saveBackupConfig, saveBackupResult, validateDataDir, validateBackupDir, ensureDataLayout };
}

module.exports = { createStorageConfig };
