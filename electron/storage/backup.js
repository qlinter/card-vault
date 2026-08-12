const fs = require("node:fs");
const path = require("node:path");
const { copyDataFilesForBackup, createDatabaseSnapshot } = require("./database-snapshot");
const { mapProgress, reportProgress } = require("./progress");

function dateFolderName(date = new Date()) { return [String(date.getFullYear()), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-"); }
function timeSuffix(date = new Date()) { return [String(date.getHours()).padStart(2, "0"), String(date.getMinutes()).padStart(2, "0"), String(date.getSeconds()).padStart(2, "0")].join(""); }
function uniqueBackupTarget(dateDir) {
  const firstTarget = path.join(dateDir, "data");
  if (!fs.existsSync(firstTarget)) return firstTarget;
  let index = 0;
  while (true) {
    const suffix = index === 0 ? timeSuffix() : `${timeSuffix()}-${index + 1}`;
    const target = path.join(dateDir, `data-${suffix}`);
    if (!fs.existsSync(target)) return target;
    index += 1;
  }
}

function createBackupService({ config, repairDataLayout }) {
  function chooseBackupDir(selectedPath) {
    const backupDir = path.resolve(selectedPath);
    config.validateBackupDir(backupDir);
    config.saveBackupConfig(backupDir);
    fs.mkdirSync(backupDir, { recursive: true });
    return { path: backupDir };
  }
  function backupDataFolder(onProgress) {
    reportProgress(onProgress, 2, "正在准备备份目录...");
    const sourceDataDir = config.getDataDir();
    const sourceDbPath = config.getDbPath();
    const backupDir = config.getBackupDir();
    config.validateBackupDir(backupDir);
    repairDataLayout(sourceDataDir);
    if (!fs.existsSync(sourceDataDir)) throw new Error("Data folder does not exist.");
    const dateDir = path.join(backupDir, dateFolderName());
    fs.mkdirSync(dateDir, { recursive: true });
    const targetDataDir = uniqueBackupTarget(dateDir);
    try {
      copyDataFilesForBackup(sourceDataDir, targetDataDir, sourceDbPath, mapProgress(onProgress, 12, 58));
      const targetDbPath = path.join(targetDataDir, "dev.db");
      fs.rmSync(targetDbPath, { force: true });
      createDatabaseSnapshot(sourceDbPath, targetDbPath, mapProgress(onProgress, 62, 96));
    } catch (error) { fs.rmSync(targetDataDir, { recursive: true, force: true }); throw error; }
    reportProgress(onProgress, 100, "备份完成。");
    return { backupRoot: backupDir, datePath: dateDir, backupPath: targetDataDir };
  }
  return { chooseBackupDir, backupDataFolder };
}

module.exports = { createBackupService, dateFolderName, uniqueBackupTarget };
