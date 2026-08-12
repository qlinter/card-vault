const fs = require("node:fs");
const path = require("node:path");
const { copyDataFilesForBackup, createDatabaseSnapshot } = require("./database-snapshot");
const { hasExistingStorageData, directoryHasEntries, isSubPath, pathsEqual, resolveSelectedDataDir } = require("./file-utils");
const { mapProgress, reportProgress } = require("./progress");

function createMigrationService({ config, inspectDataFolder, repairDataLayout }) {
  function migrateTo(selectedPath, onProgress) {
    reportProgress(onProgress, 2, "正在检查新旧存储路径...");
    const targetDir = resolveSelectedDataDir(selectedPath);
    const sourceDataDir = config.getDataDir();
    const sourceDbPath = config.getDbPath();
    repairDataLayout(sourceDataDir);
    if (pathsEqual(sourceDataDir, targetDir)) { reportProgress(onProgress, 100, "所选路径与当前存储路径相同。"); return { changed: false, currentPath: sourceDataDir }; }
    if (isSubPath(sourceDataDir, targetDir) || isSubPath(targetDir, sourceDataDir)) throw new Error("新路径和当前存储路径不能互相包含，请选择其他文件夹。");
    if (hasExistingStorageData(targetDir)) {
      const health = inspectDataFolder(targetDir, mapProgress(onProgress, 15, 85));
      if (health.integrity !== "ok") throw new Error("所选路径中的数据库未通过完整性检查，未切换存储路径。");
      config.saveStorageConfig(targetDir); config.clearCleanupConfig(); reportProgress(onProgress, 100, "已切换到现有 Card Vault 数据目录。");
      return { changed: true, previousPath: sourceDataDir, currentPath: targetDir, usedExistingData: true, health };
    }
    if (directoryHasEntries(targetDir)) throw new Error("所选文件夹不是空文件夹，也不是可识别的 Card Vault 数据目录。请改选一个空文件夹。");
    const targetExisted = fs.existsSync(targetDir);
    const parentDir = path.dirname(targetDir);
    fs.mkdirSync(parentDir, { recursive: true });
    const stagingDir = fs.mkdtempSync(path.join(parentDir, `.${path.basename(targetDir)}-migration-staging-`));
    let movedIntoPlace = false;
    try {
      copyDataFilesForBackup(sourceDataDir, stagingDir, sourceDbPath, mapProgress(onProgress, 14, 52));
      const stagedDbPath = path.join(stagingDir, "dev.db");
      if (fs.existsSync(sourceDbPath)) createDatabaseSnapshot(sourceDbPath, stagedDbPath, mapProgress(onProgress, 55, 78));
      const health = fs.existsSync(stagedDbPath) ? inspectDataFolder(stagingDir, mapProgress(onProgress, 80, 92)) : null;
      if (health && health.integrity !== "ok") throw new Error("迁移暂存数据库未通过完整性检查，未切换存储路径。");
      if (targetExisted) fs.rmdirSync(targetDir);
      fs.renameSync(stagingDir, targetDir); movedIntoPlace = true;
      try { config.saveStorageConfig(targetDir); config.clearCleanupConfig(); } catch (error) { fs.renameSync(targetDir, stagingDir); movedIntoPlace = false; if (targetExisted) fs.mkdirSync(targetDir, { recursive: true }); throw error; }
      reportProgress(onProgress, 100, "存储数据迁移完成。");
      return { changed: true, previousPath: sourceDataDir, currentPath: targetDir, usedExistingData: false, health };
    } finally { if (!movedIntoPlace && fs.existsSync(stagingDir)) fs.rmSync(stagingDir, { recursive: true, force: true }); }
  }
  return { migrateTo };
}

module.exports = { createMigrationService };
