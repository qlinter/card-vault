const fs = require("node:fs");
const path = require("node:path");
const { resolveDbPath, resolveUploadsDir } = require("../scripts/storage-paths");

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

  function getUploadsDir() {
    return resolveUploadsDir(projectRoot, { CARD_VAULT_DATA_DIR: getDataDir() });
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
    saveJson(storageConfigPath, { dataDir });
  }

  function saveCleanupConfig(pendingDeleteDir) {
    saveJson(cleanupConfigPath, { pendingDeleteDir });
  }

  function clearCleanupConfig() {
    clearFile(cleanupConfigPath);
  }

  function repairDataLayout(dataDir) {
    const uploadsDir = path.join(dataDir, "uploads");
    const rootDbPath = path.join(dataDir, "dev.db");
    const misplacedDbPath = path.join(uploadsDir, "dev.db");

    fs.mkdirSync(dataDir, { recursive: true });
    fs.mkdirSync(uploadsDir, { recursive: true });

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
    const oldDbPath = path.join(resolvedSourceDir, "dev.db");

    if (fs.existsSync(oldUploadsDir)) {
      fs.rmSync(oldUploadsDir, { recursive: true, force: true });
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
    const targetDbPath = path.join(targetDir, "dev.db");
    const targetUploadsDir = path.join(targetDir, "uploads");

    repairDataLayout(sourceDataDir);

    if (pathsEqual(sourceDataDir, targetDir)) {
      return { changed: false, currentPath: sourceDataDir };
    }

    if (isSubPath(sourceDataDir, targetDir)) {
      throw new Error("新路径不能位于当前存储路径内部，请选择其他文件夹。");
    }

    fs.mkdirSync(targetDir, { recursive: true });
    fs.mkdirSync(targetUploadsDir, { recursive: true });

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

    saveStorageConfig(targetDir);
    saveCleanupConfig(sourceDataDir);
    return { changed: true, previousPath: sourceDataDir, currentPath: targetDir };
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
    getUploadsDir,
    getDbPath,
    getEnv,
    repairDataLayout,
    migrateTo,
    runPendingCleanup
  };
}

module.exports = {
  createStorageManager
};
