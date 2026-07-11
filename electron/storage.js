const fs = require("node:fs");
const path = require("node:path");
const { resolveDbPath, resolveShareCoversDir, resolveUploadsDir } = require("../scripts/storage-paths");

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
    const rootDbPath = path.join(dataDir, "dev.db");
    const misplacedDbPath = path.join(uploadsDir, "dev.db");

    fs.mkdirSync(dataDir, { recursive: true });
    fs.mkdirSync(uploadsDir, { recursive: true });
    fs.mkdirSync(shareCoversDir, { recursive: true });

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
    const oldDbPath = path.join(resolvedSourceDir, "dev.db");

    if (fs.existsSync(oldUploadsDir)) {
      fs.rmSync(oldUploadsDir, { recursive: true, force: true });
    }

    if (fs.existsSync(oldShareCoversDir)) {
      fs.rmSync(oldShareCoversDir, { recursive: true, force: true });
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
    const targetDbPath = path.join(targetDir, "dev.db");
    const targetUploadsDir = path.join(targetDir, "uploads");
    const targetShareCoversDir = path.join(targetDir, "share-covers");

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

    if (fs.existsSync(sourceDbPath) && !fs.existsSync(targetDbPath)) {
      fs.copyFileSync(sourceDbPath, targetDbPath);
    }

    if (fs.existsSync(sourceUploadsDir)) {
      for (const entry of fs.readdirSync(sourceUploadsDir, { withFileTypes: true })) {
        if (!entry.isFile() || entry.name === "dev.db") {
          continue;
        }

        copyFileIfMissing(path.join(sourceUploadsDir, entry.name), path.join(targetUploadsDir, entry.name));
      }
    }

    if (fs.existsSync(sourceShareCoversDir)) {
      for (const entry of fs.readdirSync(sourceShareCoversDir, { withFileTypes: true })) {
        if (!entry.isFile()) {
          continue;
        }

        copyFileIfMissing(path.join(sourceShareCoversDir, entry.name), path.join(targetShareCoversDir, entry.name));
      }
    }

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
    const backupDir = getBackupDir();
    validateBackupDir(backupDir);
    repairDataLayout(sourceDataDir);

    if (!fs.existsSync(sourceDataDir)) {
      throw new Error("Data folder does not exist.");
    }

    const dateDir = path.join(backupDir, dateFolderName());
    fs.mkdirSync(dateDir, { recursive: true });
    const targetDataDir = uniqueBackupTarget(dateDir);
    fs.cpSync(sourceDataDir, targetDataDir, { recursive: true });
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
