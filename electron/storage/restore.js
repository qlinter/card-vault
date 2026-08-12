const fs = require("node:fs");
const path = require("node:path");
const { initializeDatabase } = require("../../scripts/database-migrations");
const { dateFolderName, uniqueBackupTarget } = require("./backup");
const { isSubPath, pathsEqual } = require("./file-utils");
const { inspectDataFolder } = require("./health");
const { mapProgress, reportProgress } = require("./progress");

function resolveRestoreSourcePath(selectedPath) {
  if (typeof selectedPath !== "string" || selectedPath.trim() === "") return null;
  const selectedDir = path.resolve(selectedPath);
  if (fs.existsSync(path.join(selectedDir, "dev.db"))) return selectedDir;
  let entries;
  try { entries = fs.readdirSync(selectedDir, { withFileTypes: true }); } catch { return null; }
  return entries.filter((entry) => entry.isDirectory() && /^data(?:-\d{6}(?:-\d+)?)?$/.test(entry.name)).map((entry) => path.join(selectedDir, entry.name)).filter((candidate) => fs.existsSync(path.join(candidate, "dev.db"))).map((candidate) => ({ path: candidate, modifiedAt: fs.statSync(candidate).mtimeMs })).sort((left, right) => right.modifiedAt - left.modifiedAt || right.path.localeCompare(left.path))[0]?.path ?? null;
}

function createRestoreService({ config, backupDataFolder, repairDataLayout }) {
  function restoreDataFolder(selectedPath, onProgress) {
    reportProgress(onProgress, 2, "正在验证恢复来源...");
    const sourceDataDir = resolveRestoreSourcePath(selectedPath);
    if (!sourceDataDir) throw new Error("所选文件夹中未找到可恢复的 dev.db。请选择一键备份生成的日期文件夹或其中的 data 文件夹。");
    const targetDataDir = path.resolve(config.getDataDir());
    if (pathsEqual(sourceDataDir, targetDataDir) || isSubPath(targetDataDir, sourceDataDir) || isSubPath(sourceDataDir, targetDataDir)) throw new Error("恢复来源和当前数据目录不能互相包含。");
    const sourceHealth = inspectDataFolder(sourceDataDir, mapProgress(onProgress, 4, 18));
    if (sourceHealth.integrity !== "ok") throw new Error("所选备份的 SQLite 数据库完整性检查未通过，已取消恢复。");
    let safetyBackupPath = null;
    if (fs.existsSync(config.getDbPath())) {
      try { safetyBackupPath = backupDataFolder(mapProgress(onProgress, 20, 48)).backupPath; }
      catch { const dateDir = path.join(config.getBackupDir(), dateFolderName()); fs.mkdirSync(dateDir, { recursive: true }); safetyBackupPath = uniqueBackupTarget(dateDir); fs.cpSync(targetDataDir, safetyBackupPath, { recursive: true }); reportProgress(onProgress, 48, "当前数据原始副本已保留。"); }
    }
    const parentDir = path.dirname(targetDataDir);
    const baseName = path.basename(targetDataDir);
    const suffix = `${Date.now()}-${process.pid}`;
    const stagingDir = path.join(parentDir, `.${baseName}-restore-staging-${suffix}`);
    const rollbackDir = path.join(parentDir, `.${baseName}-restore-rollback-${suffix}`);
    let migration = { appliedMigrations: [], schemaVersion: null };
    if (pathsEqual(targetDataDir, path.parse(targetDataDir).root)) throw new Error("不能将文件系统根目录作为恢复目标。");
    fs.mkdirSync(parentDir, { recursive: true });
    try {
      fs.cpSync(sourceDataDir, stagingDir, { recursive: true });
      if (inspectDataFolder(stagingDir, mapProgress(onProgress, 64, 80)).integrity !== "ok") throw new Error("备份复制到临时目录后完整性检查失败。");
      reportProgress(onProgress, 81, "正在升级恢复数据的数据库结构...");
      migration = initializeDatabase(path.join(stagingDir, "dev.db"));
      if (inspectDataFolder(stagingDir, mapProgress(onProgress, 82, 86)).integrity !== "ok") throw new Error("备份完成数据库迁移后完整性检查失败。");
      if (fs.existsSync(targetDataDir)) { reportProgress(onProgress, 84, "正在保留当前数据以便回滚..."); fs.renameSync(targetDataDir, rollbackDir); }
      try { reportProgress(onProgress, 88, "正在切换到恢复后的数据目录..."); fs.renameSync(stagingDir, targetDataDir); }
      catch (error) { if (fs.existsSync(rollbackDir) && !fs.existsSync(targetDataDir)) fs.renameSync(rollbackDir, targetDataDir); throw error; }
      if (fs.existsSync(rollbackDir)) fs.rmSync(rollbackDir, { recursive: true, force: true });
    } catch (error) { if (fs.existsSync(stagingDir)) fs.rmSync(stagingDir, { recursive: true, force: true }); throw error; }
    repairDataLayout(targetDataDir);
    const result = { restoredFrom: sourceDataDir, restoredTo: targetDataDir, safetyBackupPath, appliedMigrations: migration.appliedMigrations, schemaVersion: migration.schemaVersion, health: inspectDataFolder(targetDataDir, mapProgress(onProgress, 92, 100)) };
    reportProgress(onProgress, 100, "数据恢复完成。");
    return result;
  }
  return { restoreDataFolder };
}

module.exports = { createRestoreService, resolveRestoreSourcePath };
