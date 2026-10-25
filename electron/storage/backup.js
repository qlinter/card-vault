const fs = require("node:fs");
const path = require("node:path");
const { copyDataFilesForBackup, createDatabaseSnapshot } = require("./database-snapshot");
const { mapProgress, reportProgress } = require("./progress");
const { inspectDataFolder } = require("./health");
const { writeBackupManifest } = require("./backup-manifest");
const { directoryBytes, ensureFreeSpace } = require("./free-space");
const { createHash } = require("node:crypto");

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

function createBackupService({ config, ensureDataLayout }) {
  function sourceIdentity() {
    const database = path.resolve(config.getDbPath());
    let created = "";
    try { created = String(fs.statSync(database).birthtimeMs); } catch { /* Database not initialized yet. */ }
    return createHash("sha256").update(`${path.resolve(config.getDataDir())}|${database}|${created}`).digest("hex");
  }
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
    ensureDataLayout(sourceDataDir);
    if (!fs.existsSync(sourceDataDir)) throw new Error("Data folder does not exist.");
    // Include an external database conservatively; the reserve covers snapshot overhead.
    ensureFreeSpace(backupDir, directoryBytes(sourceDataDir) + directoryBytes(sourceDbPath));
    const dateDir = path.join(backupDir, dateFolderName());
    fs.mkdirSync(dateDir, { recursive: true });
    const targetDataDir = uniqueBackupTarget(dateDir);
    let lastBackup;
    try {
      copyDataFilesForBackup(sourceDataDir, targetDataDir, sourceDbPath, mapProgress(onProgress, 12, 58));
      const targetDbPath = path.join(targetDataDir, "dev.db");
      fs.rmSync(targetDbPath, { force: true });
      createDatabaseSnapshot(sourceDbPath, targetDbPath, mapProgress(onProgress, 62, 96));
      const health = inspectDataFolder(targetDataDir);
      if (health.integrity !== "ok" || health.missingFiles.length > 0) {
        throw new Error(`备份验证失败：数据库异常或有 ${health.missingFiles.length} 个引用文件缺失。请检查数据健康后重试。`);
      }
      const sourceKey = sourceIdentity();
      const manifest = writeBackupManifest(targetDataDir);
      lastBackup = { path: targetDataDir, dataPath: path.resolve(sourceDataDir), sourceKey, createdAt: manifest.createdAt, bytes: manifest.files.reduce((sum, file) => sum + file.bytes, 0), fileCount: manifest.files.length, imageCount: manifest.files.filter(file => /\.(?:jpg|jpeg|png|webp)$/i.test(file.name)).length, verified: true };
    } catch (error) { fs.rmSync(targetDataDir, { recursive: true, force: true }); throw error; }
    let metadataWarning;
    try { config.saveBackupResult(lastBackup); }
    catch { metadataWarning = "备份文件已完成校验，但最近备份状态未能保存。请保留本次备份路径。"; }
    reportProgress(onProgress, 100, "备份完成。");
    return { backupRoot: backupDir, datePath: dateDir, backupPath: targetDataDir, metadataWarning };
  }
  function getBackupSettings() {
    const last = config.loadStorageConfig().lastBackup;
    const valid = last && typeof last.path === "string" && Number.isFinite(Date.parse(last.createdAt)) && Number.isFinite(last.bytes) && Number.isFinite(last.imageCount);
    const lastBackup = valid && last.dataPath === path.resolve(config.getDataDir()) && last.sourceKey === sourceIdentity() ? { ...last, available: fs.existsSync(path.join(last.path, "backup-manifest.json")) } : null;
    return { path: config.getBackupDir(), lastBackup };
  }
  return { chooseBackupDir, backupDataFolder, getBackupSettings };
}

module.exports = { createBackupService, dateFolderName, uniqueBackupTarget };
