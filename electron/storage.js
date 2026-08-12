const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const { initializeDatabase } = require("../scripts/database-migrations");
const {
  resolveDbPath,
  resolveShareBackgroundsDir,
  resolveShareCoversDir,
  resolveUploadsDir
} = require("../scripts/storage-paths");

function reportProgress(callback, percent, message) {
  if (typeof callback !== "function") {
    return;
  }
  try {
    callback({ percent: Math.max(0, Math.min(100, Math.round(percent))), message });
  } catch {
    // Progress reporting must never interrupt a storage operation.
  }
}

function mapProgress(callback, start, end) {
  return ({ percent, message }) => {
    reportProgress(callback, start + ((end - start) * percent) / 100, message);
  };
}

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

function publicFileName(value, prefixes) {
  const allowedPrefixes = Array.isArray(prefixes) ? prefixes : [prefixes];
  return typeof value === "string" && allowedPrefixes.some((prefix) => value.startsWith(prefix))
    ? path.basename(value)
    : null;
}

function inspectDataFolder(dataDir, onProgress) {
  const resolvedDataDir = path.resolve(dataDir);
  const dbPath = path.join(resolvedDataDir, "dev.db");
  const issues = [];
  const missingFiles = [];
  const orphanFiles = [];
  const counts = { cards: 0, images: 0, shares: 0, shareCovers: 0, shareBackgrounds: 0 };
  reportProgress(onProgress, 5, "正在定位数据库和媒体目录...");

  if (!fs.existsSync(dbPath)) {
    reportProgress(onProgress, 100, "健康检查完成：未找到数据库。");
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
    reportProgress(onProgress, 20, "正在检查 SQLite 数据库完整性...");
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
          const fileName = publicFileName(image.path, ["/media/", "/uploads/"]);
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
      reportProgress(onProgress, 62, "数据库引用检查完成，正在核对媒体文件...");
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
  for (const [groupIndex, group] of fileGroups.entries()) {
    for (const fileName of directoryFiles(path.join(resolvedDataDir, group.directory))) {
      if (!group.references.has(fileName.toLowerCase())) {
        orphanFiles.push({ type: group.type, path: path.join(group.directory, fileName) });
      }
    }
    reportProgress(onProgress, 70 + ((groupIndex + 1) / fileGroups.length) * 25, `正在检查 ${group.directory} 目录...`);
  }

  counts.shareCovers = referenced.covers.size;
  counts.shareBackgrounds = referenced.backgrounds.size;
  if (missingFiles.length > 0) {
    issues.push(`发现 ${missingFiles.length} 个数据库引用的文件缺失。`);
  }

  const result = {
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
  reportProgress(onProgress, 100, result.ok ? "数据健康检查通过。" : "数据健康检查发现问题。");
  return result;
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

function resolveCurrentOrphanFilePath(dataDir, orphanFile, onProgress) {
  if (!orphanFile || typeof orphanFile.type !== "string" || typeof orphanFile.path !== "string") {
    return null;
  }

  const resolvedDataDir = path.resolve(dataDir);
  const currentOrphan = inspectDataFolder(resolvedDataDir, onProgress).orphanFiles.find(
    (file) => file.type === orphanFile.type && file.path === orphanFile.path
  );
  return currentOrphan ? resolveSafeOrphanPath(resolvedDataDir, currentOrphan) : null;
}

function cleanOrphanFiles(dataDir, onProgress) {
  const resolvedDataDir = path.resolve(dataDir);
  const healthBeforeCleanup = inspectDataFolder(resolvedDataDir, mapProgress(onProgress, 0, 30));
  if (!healthBeforeCleanup.ok) {
    throw new Error("数据健康检查未通过，已取消清理。请先处理数据库或缺失文件问题。");
  }

  const deletedFiles = [];
  const failedFiles = [];
  const orphanCount = healthBeforeCleanup.orphanFiles.length;
  for (const [orphanIndex, orphanFile] of healthBeforeCleanup.orphanFiles.entries()) {
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
    reportProgress(
      onProgress,
      30 + ((orphanIndex + 1) / Math.max(orphanCount, 1)) * 45,
      `正在清理未引用文件（${orphanIndex + 1}/${orphanCount}）...`
    );
  }

  return {
    deletedFiles,
    failedFiles,
    health: inspectDataFolder(resolvedDataDir, mapProgress(onProgress, 78, 100))
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
    path.join(dataDir, "share-backgrounds"),
    path.join(dataDir, "schema-backups")
  ].some(directoryHasEntries);
}

function sqliteStringLiteral(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function createDatabaseSnapshot(sourceDbPath, targetDbPath, onProgress) {
  if (!fs.existsSync(sourceDbPath)) {
    throw new Error("Database file does not exist.");
  }

  fs.mkdirSync(path.dirname(targetDbPath), { recursive: true });
  reportProgress(onProgress, 10, "正在创建 SQLite 一致性快照...");
  const sourceDb = new DatabaseSync(sourceDbPath);
  try {
    sourceDb.exec(`VACUUM INTO ${sqliteStringLiteral(targetDbPath)};`);
  } finally {
    sourceDb.close();
  }

  reportProgress(onProgress, 72, "正在验证备份数据库完整性...");
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
  reportProgress(onProgress, 100, "数据库快照已通过完整性检查。");
}

function copyDataFilesForBackup(sourceDataDir, targetDataDir, sourceDbPath, onProgress) {
  const sourceDbName = path.basename(sourceDbPath);
  const skippedDatabaseNames = new Set([
    sourceDbName,
    `${sourceDbName}-journal`,
    `${sourceDbName}-shm`,
    `${sourceDbName}-wal`
  ]);

  fs.mkdirSync(targetDataDir, { recursive: true });
  const entries = fs.readdirSync(sourceDataDir, { withFileTypes: true })
    .filter((entry) => !skippedDatabaseNames.has(entry.name));
  for (const [entryIndex, entry] of entries.entries()) {
    const sourcePath = path.join(sourceDataDir, entry.name);
    const targetPath = path.join(targetDataDir, entry.name);
    fs.cpSync(sourcePath, targetPath, { recursive: entry.isDirectory() });
    reportProgress(
      onProgress,
      ((entryIndex + 1) / Math.max(entries.length, 1)) * 100,
      `正在复制数据文件（${entryIndex + 1}/${entries.length}）...`
    );
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

  function migrateTo(selectedPath, onProgress) {
    reportProgress(onProgress, 2, "正在检查新旧存储路径...");
    const targetDir = resolveSelectedDataDir(selectedPath);
    const sourceDataDir = getDataDir();
    const sourceDbPath = getDbPath();

    repairDataLayout(sourceDataDir);
    reportProgress(onProgress, 8, "当前数据目录已准备完成。");

    if (pathsEqual(sourceDataDir, targetDir)) {
      reportProgress(onProgress, 100, "所选路径与当前存储路径相同。");
      return { changed: false, currentPath: sourceDataDir };
    }

    if (isSubPath(sourceDataDir, targetDir) || isSubPath(targetDir, sourceDataDir)) {
      throw new Error("新路径和当前存储路径不能互相包含，请选择其他文件夹。");
    }

    const targetHasExistingData = hasExistingStorageData(targetDir);
    if (targetHasExistingData) {
      const health = inspectDataFolder(targetDir, mapProgress(onProgress, 15, 85));
      if (health.integrity !== "ok") {
        throw new Error("所选路径中的数据库未通过完整性检查，未切换存储路径。");
      }
      saveStorageConfig(targetDir);
      clearCleanupConfig();
      reportProgress(onProgress, 100, "已切换到现有 Card Vault 数据目录。");
      return {
        changed: true,
        previousPath: sourceDataDir,
        currentPath: targetDir,
        usedExistingData: true,
        health
      };
    }

    if (directoryHasEntries(targetDir)) {
      throw new Error("所选文件夹不是空文件夹，也不是可识别的 Card Vault 数据目录。请改选一个空文件夹。");
    }

    const targetExisted = fs.existsSync(targetDir);
    const parentDir = path.dirname(targetDir);
    fs.mkdirSync(parentDir, { recursive: true });
    const stagingDir = fs.mkdtempSync(path.join(parentDir, `.${path.basename(targetDir)}-migration-staging-`));

    let movedIntoPlace = false;
    try {
      reportProgress(onProgress, 12, "正在创建迁移暂存目录...");
      copyDataFilesForBackup(sourceDataDir, stagingDir, sourceDbPath, mapProgress(onProgress, 14, 52));

      const stagedDbPath = path.join(stagingDir, "dev.db");
      if (fs.existsSync(sourceDbPath)) {
        createDatabaseSnapshot(sourceDbPath, stagedDbPath, mapProgress(onProgress, 55, 78));
      }

      const health = fs.existsSync(stagedDbPath)
        ? inspectDataFolder(stagingDir, mapProgress(onProgress, 80, 92))
        : null;
      if (health && health.integrity !== "ok") {
        throw new Error("迁移暂存数据库未通过完整性检查，未切换存储路径。");
      }

      reportProgress(onProgress, 94, "正在原子切换到新存储目录...");
      if (targetExisted) {
        fs.rmdirSync(targetDir);
      }
      fs.renameSync(stagingDir, targetDir);
      movedIntoPlace = true;

      try {
        saveStorageConfig(targetDir);
        clearCleanupConfig();
      } catch (error) {
        fs.renameSync(targetDir, stagingDir);
        movedIntoPlace = false;
        if (targetExisted) {
          fs.mkdirSync(targetDir, { recursive: true });
        }
        throw error;
      }

      reportProgress(onProgress, 100, "存储数据迁移完成。");
      return {
        changed: true,
        previousPath: sourceDataDir,
        currentPath: targetDir,
        usedExistingData: false,
        health
      };
    } finally {
      if (!movedIntoPlace && fs.existsSync(stagingDir)) {
        fs.rmSync(stagingDir, { recursive: true, force: true });
      }
    }
  }

  function chooseBackupDir(selectedPath) {
    const backupDir = path.resolve(selectedPath);
    validateBackupDir(backupDir);
    saveBackupConfig(backupDir);
    fs.mkdirSync(backupDir, { recursive: true });
    return { path: backupDir };
  }

  function backupDataFolder(onProgress) {
    reportProgress(onProgress, 2, "正在准备备份目录...");
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
      copyDataFilesForBackup(sourceDataDir, targetDataDir, sourceDbPath, mapProgress(onProgress, 12, 58));
      const targetDbPath = path.join(targetDataDir, "dev.db");
      fs.rmSync(targetDbPath, { force: true });
      createDatabaseSnapshot(sourceDbPath, targetDbPath, mapProgress(onProgress, 62, 96));
    } catch (error) {
      fs.rmSync(targetDataDir, { recursive: true, force: true });
      throw error;
    }
    reportProgress(onProgress, 100, "备份完成。");
    return { backupRoot: backupDir, datePath: dateDir, backupPath: targetDataDir };
  }

  function restoreDataFolder(selectedPath, onProgress) {
    reportProgress(onProgress, 2, "正在验证恢复来源...");
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

    const sourceHealth = inspectDataFolder(sourceDataDir, mapProgress(onProgress, 4, 18));
    if (sourceHealth.integrity !== "ok") {
      throw new Error("所选备份的 SQLite 数据库完整性检查未通过，已取消恢复。");
    }

    let safetyBackupPath = null;
    if (fs.existsSync(getDbPath())) {
      try {
        safetyBackupPath = backupDataFolder(mapProgress(onProgress, 20, 48)).backupPath;
      } catch {
        reportProgress(onProgress, 34, "标准安全备份失败，正在保留原始数据副本...");
        const dateDir = path.join(getBackupDir(), dateFolderName());
        fs.mkdirSync(dateDir, { recursive: true });
        safetyBackupPath = uniqueBackupTarget(dateDir);
        fs.cpSync(targetDataDir, safetyBackupPath, { recursive: true });
        reportProgress(onProgress, 48, "当前数据原始副本已保留。");
      }
    }

    const parentDir = path.dirname(targetDataDir);
    const baseName = path.basename(targetDataDir);
    const suffix = `${Date.now()}-${process.pid}`;
    const stagingDir = path.join(parentDir, `.${baseName}-restore-staging-${suffix}`);
    const rollbackDir = path.join(parentDir, `.${baseName}-restore-rollback-${suffix}`);
    let migration = { appliedMigrations: [], schemaVersion: null };
    if (pathsEqual(targetDataDir, path.parse(targetDataDir).root)) {
      throw new Error("不能将文件系统根目录作为恢复目标。");
    }

    fs.mkdirSync(parentDir, { recursive: true });
    try {
      reportProgress(onProgress, 54, "正在复制备份到恢复暂存目录...");
      fs.cpSync(sourceDataDir, stagingDir, { recursive: true });
      const stagedHealth = inspectDataFolder(stagingDir, mapProgress(onProgress, 64, 80));
      if (stagedHealth.integrity !== "ok") {
        throw new Error("备份复制到临时目录后完整性检查失败。");
      }

      reportProgress(onProgress, 81, "正在升级恢复数据的数据库结构...");
      const stagedDbPath = path.join(stagingDir, "dev.db");
      migration = initializeDatabase(stagedDbPath);
      const migratedHealth = inspectDataFolder(stagingDir, mapProgress(onProgress, 82, 86));
      if (migratedHealth.integrity !== "ok") {
        throw new Error("备份完成数据库迁移后完整性检查失败。");
      }

      if (fs.existsSync(targetDataDir)) {
        reportProgress(onProgress, 84, "正在保留当前数据以便回滚...");
        fs.renameSync(targetDataDir, rollbackDir);
      }
      try {
        reportProgress(onProgress, 88, "正在切换到恢复后的数据目录...");
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
    const result = {
      restoredFrom: sourceDataDir,
      restoredTo: targetDataDir,
      safetyBackupPath,
      appliedMigrations: migration.appliedMigrations,
      schemaVersion: migration.schemaVersion,
      health: inspectDataFolder(targetDataDir, mapProgress(onProgress, 92, 100))
    };
    reportProgress(onProgress, 100, "数据恢复完成。");
    return result;
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
    inspectDataFolder: (dataDir = getDataDir(), onProgress) => inspectDataFolder(dataDir, onProgress),
    resolveOrphanFilePath: (orphanFile, onProgress) => resolveCurrentOrphanFilePath(getDataDir(), orphanFile, onProgress),
    cleanOrphanFiles: (onProgress) => cleanOrphanFiles(getDataDir(), onProgress),
    restoreDataFolder,
    getBackupSettings,
    migrateTo,
    runPendingCleanup
  };
}

module.exports = {
  createStorageManager
};
