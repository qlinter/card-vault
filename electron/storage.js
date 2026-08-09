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

function directoryHasEntries(directoryPath) {
  if (!fs.existsSync(directoryPath)) {
    return false;
  }

  return fs.readdirSync(directoryPath).length > 0;
}

function directoryFiles(directoryPath) {
  if (!fs.existsSync(directoryPath)) {
    return [];
  }
  return fs.readdirSync(directoryPath, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name);
}

function tableExists(db, tableName) {
  return Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(tableName));
}

function publicFileName(value, prefix) {
  return typeof value === "string" && value.startsWith(prefix) ? path.basename(value) : null;
}

function inspectDataFolder(dataDir) {
  const resolvedDataDir = path.resolve(dataDir);
  const dbPath = path.join(resolvedDataDir, "dev.db");
  const issues = [];
  const missingFiles = [];
  const orphanFiles = [];
  const counts = { cards: 0, images: 0, shares: 0, shareCovers: 0, shareBackgrounds: 0 };

  if (!fs.existsSync(dbPath)) {
    return {
      ok: false,
      checkedAt: new Date().toISOString(),
      dataPath: resolvedDataDir,
      databasePath: dbPath,
      integrity: "missing",
      counts,
      missingFiles,
      orphanFiles,
      issues: ["数据库文件 dev.db 不存在。"]
    };
  }

  const referenced = {
    uploads: new Set(),
    covers: new Set(),
    backgrounds: new Set()
  };
  let integrity = "error";
  try {
    const db = new DatabaseSync(dbPath, { readOnly: true });
    try {
      const integrityRows = db.prepare("PRAGMA integrity_check;").all();
      const valid = integrityRows.length === 1 && Object.values(integrityRows[0]).some((value) => String(value).toLowerCase() === "ok");
      integrity = valid ? "ok" : "failed";
      if (!valid) {
        issues.push("SQLite 数据库完整性检查未通过。");
      }

      if (!tableExists(db, "Card") || !tableExists(db, "CardImage")) {
        issues.push("数据库缺少 Card 或 CardImage 核心数据表。");
      } else {
        counts.cards = Number(db.prepare("SELECT COUNT(*) AS count FROM Card").get().count);
        const images = db.prepare("SELECT path FROM CardImage").all();
        counts.images = images.length;
        for (const image of images) {
          const fileName = publicFileName(image.path, "/media/");
          if (fileName) {
            referenced.uploads.add(fileName.toLowerCase());
            if (!fs.existsSync(path.join(resolvedDataDir, "uploads", fileName))) {
              missingFiles.push({ type: "cardImage", path: image.path });
            }
          }
        }
      }

      if (tableExists(db, "ShareCollection")) {
        const shares = db.prepare("SELECT coverImagePath, backgroundImagePath FROM ShareCollection").all();
        counts.shares = shares.length;
        for (const share of shares) {
          const cover = publicFileName(share.coverImagePath, "/share-covers/");
          if (cover) {
            referenced.covers.add(cover.toLowerCase());
            if (!fs.existsSync(path.join(resolvedDataDir, "share-covers", cover))) {
              missingFiles.push({ type: "shareCover", path: share.coverImagePath });
            }
          }
          const background = publicFileName(share.backgroundImagePath, "/share-backgrounds/");
          if (background) {
            referenced.backgrounds.add(background.toLowerCase());
            if (!fs.existsSync(path.join(resolvedDataDir, "share-backgrounds", background))) {
              missingFiles.push({ type: "shareBackground", path: share.backgroundImagePath });
            }
          }
        }
      }
    } finally {
      db.close();
    }
  } catch (error) {
    issues.push(`无法读取数据库：${error instanceof Error ? error.message : "未知错误"}`);
  }

  const fileGroups = [
    { type: "cardImage", directory: "uploads", references: referenced.uploads },
    { type: "shareCover", directory: "share-covers", references: referenced.covers },
    { type: "shareBackground", directory: "share-backgrounds", references: referenced.backgrounds }
  ];
  for (const group of fileGroups) {
    for (const fileName of directoryFiles(path.join(resolvedDataDir, group.directory))) {
      if (!group.references.has(fileName.toLowerCase())) {
        orphanFiles.push({ type: group.type, path: path.join(group.directory, fileName) });
      }
    }
  }

  counts.shareCovers = referenced.covers.size;
  counts.shareBackgrounds = referenced.backgrounds.size;
  if (missingFiles.length > 0) {
    issues.push(`发现 ${missingFiles.length} 个数据库引用的文件缺失。`);
  }

  return {
    ok: integrity === "ok" && issues.length === 0,
    checkedAt: new Date().toISOString(),
    dataPath: resolvedDataDir,
    databasePath: dbPath,
    integrity,
    counts,
    missingFiles,
    orphanFiles,
    issues
  };
}

const orphanDirectoryByType = {
  cardImage: "uploads",
  shareCover: "share-covers",
  shareBackground: "share-backgrounds"
};

function resolveSafeOrphanPath(dataDir, orphanFile) {
  const directory = orphanDirectoryByType[orphanFile.type];
  if (!directory || typeof orphanFile.path !== "string") {
    return null;
  }

  const expectedDirectory = path.resolve(dataDir, directory);
  const candidate = path.resolve(dataDir, orphanFile.path);
  return path.dirname(candidate) === expectedDirectory ? candidate : null;
}

function resolveCurrentOrphanFilePath(dataDir, orphanFile) {
  if (!orphanFile || typeof orphanFile.type !== "string" || typeof orphanFile.path !== "string") {
    return null;
  }

  const resolvedDataDir = path.resolve(dataDir);
  const currentOrphan = inspectDataFolder(resolvedDataDir).orphanFiles.find(
    (file) => file.type === orphanFile.type && file.path === orphanFile.path
  );
  return currentOrphan ? resolveSafeOrphanPath(resolvedDataDir, currentOrphan) : null;
}

function cleanOrphanFiles(dataDir) {
  const resolvedDataDir = path.resolve(dataDir);
  const healthBeforeCleanup = inspectDataFolder(resolvedDataDir);
  if (!healthBeforeCleanup.ok) {
    throw new Error("数据健康检查未通过，已取消清理。请先处理数据库或缺失文件问题。");
  }

  const deletedFiles = [];
  const failedFiles = [];
  for (const orphanFile of healthBeforeCleanup.orphanFiles) {
    const filePath = resolveSafeOrphanPath(resolvedDataDir, orphanFile);
    if (!filePath) {
      failedFiles.push({ ...orphanFile, reason: "文件路径不在允许清理的媒体目录中。" });
      continue;
    }

    try {
      if (fs.existsSync(filePath)) {
        fs.rmSync(filePath, { force: true });
        deletedFiles.push(orphanFile);
      }
    } catch (error) {
      failedFiles.push({
        ...orphanFile,
        reason: error instanceof Error ? error.message : "删除文件失败。"
      });
    }
  }

  return {
    deletedFiles,
    failedFiles,
    health: inspectDataFolder(resolvedDataDir)
  };
}

function hasExistingStorageData(dataDir) {
  const databaseNames = ["dev.db", "dev.db-journal", "dev.db-shm", "dev.db-wal"];
  if (databaseNames.some((name) => fs.existsSync(path.join(dataDir, name)))) {
    return true;
  }

  return [
    path.join(dataDir, "uploads"),
    path.join(dataDir, "share-covers"),
    path.join(dataDir, "share-backgrounds")
  ].some(directoryHasEntries);
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

function resolveRestoreSourcePath(selectedPath) {
  if (typeof selectedPath !== "string" || selectedPath.trim() === "") {
    return null;
  }

  const selectedDir = path.resolve(selectedPath);
  if (fs.existsSync(path.join(selectedDir, "dev.db"))) {
    return selectedDir;
  }

  let entries;
  try {
    entries = fs.readdirSync(selectedDir, { withFileTypes: true });
  } catch {
    return null;
  }

  const candidates = entries
    .filter((entry) => entry.isDirectory() && /^data(?:-\d{6}(?:-\d+)?)?$/.test(entry.name))
    .map((entry) => path.join(selectedDir, entry.name))
    .filter((candidate) => fs.existsSync(path.join(candidate, "dev.db")))
    .map((candidate) => ({
      path: candidate,
      modifiedAt: fs.statSync(candidate).mtimeMs
    }))
    .sort((left, right) => right.modifiedAt - left.modifiedAt || right.path.localeCompare(left.path));

  return candidates[0]?.path ?? null;
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
    const targetHasExistingData = hasExistingStorageData(targetDir);

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

    if (!targetHasExistingData) {
      if (fs.existsSync(sourceDbPath)) {
        fs.copyFileSync(sourceDbPath, targetDbPath);
      }

      copyDirectoryFilesIfMissing(sourceUploadsDir, targetUploadsDir);
      copyDirectoryFilesIfMissing(sourceShareCoversDir, targetShareCoversDir);
      copyDirectoryFilesIfMissing(sourceShareBackgroundsDir, targetShareBackgroundsDir);
    }

    saveStorageConfig(targetDir);
    clearCleanupConfig();
    return { changed: true, previousPath: sourceDataDir, currentPath: targetDir, usedExistingData: targetHasExistingData };
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

  function restoreDataFolder(selectedPath) {
    const sourceDataDir = resolveRestoreSourcePath(selectedPath);
    if (!sourceDataDir) {
      throw new Error("所选文件夹中未找到可恢复的 dev.db。请选择一键备份生成的日期文件夹或其中的 data 文件夹。");
    }
    const targetDataDir = path.resolve(getDataDir());
    if (
      pathsEqual(sourceDataDir, targetDataDir) ||
      isSubPath(targetDataDir, sourceDataDir) ||
      isSubPath(sourceDataDir, targetDataDir)
    ) {
      throw new Error("恢复来源和当前数据目录不能互相包含。");
    }

    const sourceHealth = inspectDataFolder(sourceDataDir);
    if (sourceHealth.integrity !== "ok") {
      throw new Error("所选备份的 SQLite 数据库完整性检查未通过，已取消恢复。");
    }

    let safetyBackupPath = null;
    if (fs.existsSync(getDbPath())) {
      try {
        safetyBackupPath = backupDataFolder().backupPath;
      } catch {
        const dateDir = path.join(getBackupDir(), dateFolderName());
        fs.mkdirSync(dateDir, { recursive: true });
        safetyBackupPath = uniqueBackupTarget(dateDir);
        fs.cpSync(targetDataDir, safetyBackupPath, { recursive: true });
      }
    }

    const parentDir = path.dirname(targetDataDir);
    const baseName = path.basename(targetDataDir);
    const suffix = `${Date.now()}-${process.pid}`;
    const stagingDir = path.join(parentDir, `.${baseName}-restore-staging-${suffix}`);
    const rollbackDir = path.join(parentDir, `.${baseName}-restore-rollback-${suffix}`);
    if (pathsEqual(targetDataDir, path.parse(targetDataDir).root)) {
      throw new Error("不能将文件系统根目录作为恢复目标。");
    }

    fs.mkdirSync(parentDir, { recursive: true });
    try {
      fs.cpSync(sourceDataDir, stagingDir, { recursive: true });
      const stagedHealth = inspectDataFolder(stagingDir);
      if (stagedHealth.integrity !== "ok") {
        throw new Error("备份复制到临时目录后完整性检查失败。");
      }

      if (fs.existsSync(targetDataDir)) {
        fs.renameSync(targetDataDir, rollbackDir);
      }
      try {
        fs.renameSync(stagingDir, targetDataDir);
      } catch (error) {
        if (fs.existsSync(rollbackDir) && !fs.existsSync(targetDataDir)) {
          fs.renameSync(rollbackDir, targetDataDir);
        }
        throw error;
      }
      if (fs.existsSync(rollbackDir)) {
        fs.rmSync(rollbackDir, { recursive: true, force: true });
      }
    } catch (error) {
      if (fs.existsSync(stagingDir)) {
        fs.rmSync(stagingDir, { recursive: true, force: true });
      }
      throw error;
    }

    repairDataLayout(targetDataDir);
    return {
      restoredFrom: sourceDataDir,
      restoredTo: targetDataDir,
      safetyBackupPath,
      health: inspectDataFolder(targetDataDir)
    };
  }

  function getBackupSettings() {
    return { path: getBackupDir() };
  }

  function runPendingCleanup() {
    const pendingDeleteDir = loadCleanupConfig().pendingDeleteDir;
    if (!pendingDeleteDir) {
      return;
    }

    try {
      clearCleanupConfig();
      log(`Pending storage cleanup cancelled to preserve data: ${pendingDeleteDir}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown cleanup error.";
      log(`Failed to cancel pending storage cleanup: ${message}`);
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
    resolveRestoreSourcePath,
    inspectDataFolder: (dataDir = getDataDir()) => inspectDataFolder(dataDir),
    resolveOrphanFilePath: (orphanFile) => resolveCurrentOrphanFilePath(getDataDir(), orphanFile),
    cleanOrphanFiles: () => cleanOrphanFiles(getDataDir()),
    restoreDataFolder,
    getBackupSettings,
    migrateTo,
    runPendingCleanup
  };
}

module.exports = {
  createStorageManager
};
