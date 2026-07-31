const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const {
  resolveDbPath,
  resolveShareBackgroundsDir,
  resolveShareCoversDir,
  resolveUploadsDir
} = require("../scripts/storage-paths");

function loadJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return {};
  }
}

function saveJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
}

function clearFile(filePath) {
  if (fs.existsSync(filePath)) {
    fs.rmSync(filePath, { force: true });
  }
}

function pathsEqual(leftPath, rightPath) {
  return path.resolve(leftPath) === path.resolve(rightPath);
}

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
  if (!fs.existsSync(targetPath)) {
    fs.copyFileSync(sourcePath, targetPath);
  }
}

function copyDirectoryFilesIfMissing(sourceDir, targetDir) {
  if (!fs.existsSync(sourceDir)) {
    return;
  }

  fs.mkdirSync(targetDir, { recursive: true });
  for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    if (!entry.isFile()) {
      continue;
    }

    copyFileIfMissing(path.join(sourceDir, entry.name), path.join(targetDir, entry.name));
  }
}

function sqliteStringLiteral(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function createDatabaseSnapshot(sourceDbPath, targetDbPath) {
  if (!fs.existsSync(sourceDbPath)) {
    throw new Error("Database file does not exist.");
  }

  fs.mkdirSync(path.dirname(targetDbPath), { recursive: true });
  const sourceDb = new DatabaseSync(sourceDbPath);
  try {
    sourceDb.exec(`VACUUM INTO ${sqliteStringLiteral(targetDbPath)};`);
  } finally {
    sourceDb.close();
  }

  const backupDb = new DatabaseSync(targetDbPath, { readOnly: true });
  try {
    const integrityRows = backupDb.prepare("PRAGMA integrity_check;").all();
    const isValid =
      integrityRows.length === 1 &&
      Object.values(integrityRows[0]).some((value) => String(value).toLowerCase() === "ok");
    if (!isValid) {
      throw new Error("Backup database integrity check failed.");
    }
  } finally {
    backupDb.close();
  }
}

function copyDataFilesForBackup(sourceDataDir, targetDataDir, sourceDbPath) {
  const sourceDbDir = path.dirname(path.resolve(sourceDbPath));
  const sourceDbName = path.basename(sourceDbPath);
  const skippedDatabaseNames = new Set([
    sourceDbName,
    `${sourceDbName}-journal`,
    `${sourceDbName}-shm`,
    `${sourceDbName}-wal`
  ]);

  fs.mkdirSync(targetDataDir, { recursive: true });
  for (const entry of fs.readdirSync(sourceDataDir, { withFileTypes: true })) {
    if (pathsEqual(sourceDataDir, sourceDbDir) && skippedDatabaseNames.has(entry.name)) {
      continue;
    }

    const sourcePath = path.join(sourceDataDir, entry.name);
    const targetPath = path.join(targetDataDir, entry.name);
    fs.cpSync(sourcePath, targetPath, { recursive: entry.isDirectory() });
  }
}

function dateFolderName(date = new Date()) {
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return [year, month, day].join("-");
}

function timeSuffix(date = new Date()) {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return [hours, minutes, seconds].join("");
}

function uniqueBackupTarget(dateDir) {
  const firstTarget = path.join(dateDir, "data");
  if (!fs.existsSync(firstTarget)) {
    return firstTarget;
  }

  let index = 0;
  while (true) {
    const suffix = index === 0 ? timeSuffix() : timeSuffix() + "-" + (index + 1);
    const target = path.join(dateDir, "data-" + suffix);
    if (!fs.existsSync(target)) {
      return target;
    }
    index += 1;
  }
}

function flattenNestedUploads(uploadsDir) {
  const nestedUploadsDir = path.join(uploadsDir, "uploads");
  if (!fs.existsSync(nestedUploadsDir)) {
    return;
  }

  for (const entry of fs.readdirSync(nestedUploadsDir, { withFileTypes: true })) {
    if (!entry.isFile()) {
      continue;
    }

    copyFileIfMissing(path.join(nestedUploadsDir, entry.name), path.join(uploadsDir, entry.name));
  }

  fs.rmSync(nestedUploadsDir, { recursive: true, force: true });
}

function createStorageManager({ appDataRoot, projectRoot, log }) {
  const storageConfigPath = path.join(appDataRoot, "storage-config.json");
  const cleanupConfigPath = path.join(appDataRoot, "cleanup-config.json");

  function loadStorageConfig() {
    return loadJson(storageConfigPath);
  }

  function loadCleanupConfig() {
    return loadJson(cleanupConfigPath);
  }

  function getDataDir() {
    return loadStorageConfig().dataDir || path.join(appDataRoot, "data");
  }

  function getBackupDir() {
    return loadStorageConfig().backupDir || path.join(appDataRoot, "backups");
  }

  function getUploadsDir() {
    return resolveUploadsDir(projectRoot, { CARD_VAULT_DATA_DIR: getDataDir() });
  }

  function getShareCoversDir() {
    return resolveShareCoversDir(projectRoot, { CARD_VAULT_DATA_DIR: getDataDir() });
  }

  function getShareBackgroundsDir() {
    return resolveShareBackgroundsDir(projectRoot, { CARD_VAULT_DATA_DIR: getDataDir() });
  }

  function getDbPath() {
    return resolveDbPath(projectRoot, {
      CARD_VAULT_DATA_DIR: getDataDir(),
      CARD_VAULT_DB_PATH: process.env.CARD_VAULT_DB_PATH
    });
  }

  function getEnv() {
    const dataDir = getDataDir();
    const dbPath = getDbPath();

    return {
      CARD_VAULT_DATA_DIR: dataDir,
      CARD_VAULT_DB_PATH: dbPath,
      CARD_VAULT_STORAGE_CONFIG_PATH: storageConfigPath
    };
  }

  function saveStorageConfig(dataDir) {
    const current = loadStorageConfig();
    saveJson(storageConfigPath, { ...current, dataDir });
  }

  function saveBackupConfig(backupDir) {
    const current = loadStorageConfig();
    saveJson(storageConfigPath, { ...current, backupDir });
  }

  function validateBackupDir(backupDir) {
    const dataDir = path.resolve(getDataDir());
    const resolvedBackupDir = path.resolve(backupDir);

    if (pathsEqual(dataDir, resolvedBackupDir) || isSubPath(dataDir, resolvedBackupDir)) {
      throw new Error("Backup path cannot be inside the current data folder.");
    }
  }

  function saveCleanupConfig(pendingDeleteDir) {
    saveJson(cleanupConfigPath, { pendingDeleteDir });
  }

  function clearCleanupConfig() {
    clearFile(cleanupConfigPath);
  }

  function repairDataLayout(dataDir) {
    const uploadsDir = path.join(dataDir, "uploads");
    const shareCoversDir = path.join(dataDir, "share-covers");
    const shareBackgroundsDir = path.join(dataDir, "share-backgrounds");
    const rootDbPath = path.join(dataDir, "dev.db");
    const misplacedDbPath = path.join(uploadsDir, "dev.db");

    fs.mkdirSync(dataDir, { recursive: true });
    fs.mkdirSync(uploadsDir, { recursive: true });
    fs.mkdirSync(shareCoversDir, { recursive: true });
    fs.mkdirSync(shareBackgroundsDir, { recursive: true });

    if (fs.existsSync(misplacedDbPath) && !fs.existsSync(rootDbPath)) {
      fs.renameSync(misplacedDbPath, rootDbPath);
    }

    flattenNestedUploads(uploadsDir);

    if (fs.existsSync(misplacedDbPath)) {
      fs.rmSync(misplacedDbPath, { force: true });
    }
  }

  function cleanupOldDataContents(sourceDataDir, targetDir) {
    const resolvedSourceDir = path.resolve(sourceDataDir);
    const resolvedTargetDir = path.resolve(targetDir);
    const resolvedProjectRoot = path.resolve(projectRoot);

    if (pathsEqual(resolvedSourceDir, resolvedTargetDir) || !fs.existsSync(resolvedSourceDir)) {
      return;
    }

    if (pathsEqual(resolvedSourceDir, resolvedProjectRoot)) {
      throw new Error("旧存储路径异常，已阻止清理项目目录。");
    }

    if (isSubPath(resolvedSourceDir, resolvedTargetDir)) {
      throw new Error("新路径位于旧路径内部，不能清理旧路径内容。");
    }

    const oldUploadsDir = path.join(resolvedSourceDir, "uploads");
    const oldShareCoversDir = path.join(resolvedSourceDir, "share-covers");
    const oldShareBackgroundsDir = path.join(resolvedSourceDir, "share-backgrounds");
    const oldDbPath = path.join(resolvedSourceDir, "dev.db");

    if (fs.existsSync(oldUploadsDir)) {
      fs.rmSync(oldUploadsDir, { recursive: true, force: true });
    }

    if (fs.existsSync(oldShareCoversDir)) {
      fs.rmSync(oldShareCoversDir, { recursive: true, force: true });
    }

    if (fs.existsSync(oldShareBackgroundsDir)) {
      fs.rmSync(oldShareBackgroundsDir, { recursive: true, force: true });
    }

    if (fs.existsSync(oldDbPath)) {
      fs.rmSync(oldDbPath, { force: true });
    }
  }

  function migrateTo(selectedPath) {
    const targetDir = resolveSelectedDataDir(selectedPath);
    const sourceDataDir = getDataDir();
    const sourceDbPath = getDbPath();
    const sourceUploadsDir = getUploadsDir();
    const sourceShareCoversDir = getShareCoversDir();
    const sourceShareBackgroundsDir = getShareBackgroundsDir();
    const targetDbPath = path.join(targetDir, "dev.db");
    const targetUploadsDir = path.join(targetDir, "uploads");
    const targetShareCoversDir = path.join(targetDir, "share-covers");
    const targetShareBackgroundsDir = path.join(targetDir, "share-backgrounds");

    repairDataLayout(sourceDataDir);

    if (pathsEqual(sourceDataDir, targetDir)) {
      return { changed: false, currentPath: sourceDataDir };
    }

    if (isSubPath(sourceDataDir, targetDir)) {
      throw new Error("新路径不能位于当前存储路径内部，请选择其他文件夹。");
    }

    fs.mkdirSync(targetDir, { recursive: true });
    fs.mkdirSync(targetUploadsDir, { recursive: true });
    fs.mkdirSync(targetShareCoversDir, { recursive: true });
    fs.mkdirSync(targetShareBackgroundsDir, { recursive: true });

    if (fs.existsSync(sourceDbPath) && !fs.existsSync(targetDbPath)) {
      fs.copyFileSync(sourceDbPath, targetDbPath);
    }

    copyDirectoryFilesIfMissing(sourceUploadsDir, targetUploadsDir);
    copyDirectoryFilesIfMissing(sourceShareCoversDir, targetShareCoversDir);
    copyDirectoryFilesIfMissing(sourceShareBackgroundsDir, targetShareBackgroundsDir);

    saveStorageConfig(targetDir);
    saveCleanupConfig(sourceDataDir);
    return { changed: true, previousPath: sourceDataDir, currentPath: targetDir };
  }

  function chooseBackupDir(selectedPath) {
    const backupDir = path.resolve(selectedPath);
    validateBackupDir(backupDir);
    saveBackupConfig(backupDir);
    fs.mkdirSync(backupDir, { recursive: true });
    return { path: backupDir };
  }

  function backupDataFolder() {
    const sourceDataDir = getDataDir();
    const sourceDbPath = getDbPath();
    const backupDir = getBackupDir();
    validateBackupDir(backupDir);
    repairDataLayout(sourceDataDir);

    if (!fs.existsSync(sourceDataDir)) {
      throw new Error("Data folder does not exist.");
    }

    const dateDir = path.join(backupDir, dateFolderName());
    fs.mkdirSync(dateDir, { recursive: true });
    const targetDataDir = uniqueBackupTarget(dateDir);
    try {
      copyDataFilesForBackup(sourceDataDir, targetDataDir, sourceDbPath);
      const targetDbPath = path.join(targetDataDir, "dev.db");
      fs.rmSync(targetDbPath, { force: true });
      createDatabaseSnapshot(sourceDbPath, targetDbPath);
    } catch (error) {
      fs.rmSync(targetDataDir, { recursive: true, force: true });
      throw error;
    }
    return { backupRoot: backupDir, datePath: dateDir, backupPath: targetDataDir };
  }

  function getBackupSettings() {
    return { path: getBackupDir() };
  }

  function runPendingCleanup() {
    const pendingDeleteDir = loadCleanupConfig().pendingDeleteDir;
    if (!pendingDeleteDir) {
      return;
    }

    const currentDataDir = getDataDir();
    if (pathsEqual(pendingDeleteDir, currentDataDir)) {
      clearCleanupConfig();
      return;
    }

    try {
      cleanupOldDataContents(pendingDeleteDir, currentDataDir);
      log(`Old storage contents cleaned: ${pendingDeleteDir}`);
      clearCleanupConfig();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown cleanup error.";
      log(`Old storage cleanup failed: ${message}`);
    }
  }

  return {
    getDataDir,
    getBackupDir,
    getUploadsDir,
    getShareCoversDir,
    getShareBackgroundsDir,
    getDbPath,
    getEnv,
    repairDataLayout,
    chooseBackupDir,
    backupDataFolder,
    getBackupSettings,
    migrateTo,
    runPendingCleanup
  };
}

module.exports = {
  createStorageManager
};
