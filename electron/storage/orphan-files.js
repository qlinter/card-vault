const fs = require("node:fs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { DatabaseSync } = require("node:sqlite");
const { inspectDataFolder } = require("./health");
const { mapProgress, reportProgress } = require("./progress");

const orphanDirectoryByType = { cardImage: "uploads", queueSource: "entry-queue", shareCover: "share-covers", shareBackground: "share-backgrounds" };

function resolveSafeOrphanPath(dataDir, orphanFile) {
  const directory = orphanDirectoryByType[orphanFile?.type];
  if (!directory || typeof orphanFile?.path !== "string") return null;
  const expectedDirectory = path.resolve(dataDir, directory);
  const candidate = path.resolve(dataDir, orphanFile.path);
  return path.dirname(candidate) === expectedDirectory ? candidate : null;
}

function resolveCurrentOrphanFilePath(dataDir, orphanFile, onProgress) {
  if (!orphanFile || typeof orphanFile.type !== "string" || typeof orphanFile.path !== "string") return null;
  const resolvedDataDir = path.resolve(dataDir);
  const currentOrphan = inspectDataFolder(resolvedDataDir, onProgress).orphanFiles.find((file) => file.type === orphanFile.type && file.path === orphanFile.path);
  return currentOrphan ? resolveSafeOrphanPath(resolvedDataDir, currentOrphan) : null;
}

function cleanOrphanFiles(dataDir, onProgress) {
  const resolvedDataDir = path.resolve(dataDir);
  const healthBeforeCleanup = inspectDataFolder(resolvedDataDir, mapProgress(onProgress, 0, 30));
  if (!healthBeforeCleanup.ok) throw new Error("数据健康检查未通过，已取消清理。请先处理数据库或缺失文件问题。");
  const deletedFiles = [];
  const failedFiles = [];
  const recoveryPath = path.join(resolvedDataDir, ".recovery", `${Date.now()}-${randomUUID()}`);
  const orphanCount = healthBeforeCleanup.orphanFiles.length;
  const db = new DatabaseSync(path.join(resolvedDataDir, "dev.db"));
  try {
    db.exec("PRAGMA busy_timeout=5000; BEGIN IMMEDIATE;");
    const currentHealth = inspectDataFolder(resolvedDataDir);
    if (!currentHealth.ok) throw new Error("数据已发生变化，已取消清理。请重新检查数据健康。");
    const currentOrphans = new Set(currentHealth.orphanFiles.map((file) => file.path));
    for (const [index, orphanFile] of healthBeforeCleanup.orphanFiles.entries()) {
      if (!currentOrphans.has(orphanFile.path)) continue;
      const filePath = resolveSafeOrphanPath(resolvedDataDir, orphanFile);
      if (!filePath) { failedFiles.push({ ...orphanFile, reason: "文件路径不在允许清理的媒体目录中。" }); continue; }
      try {
        if (fs.existsSync(filePath)) {
          const retainedPath = path.join(recoveryPath, orphanFile.path);
          fs.mkdirSync(path.dirname(retainedPath), { recursive: true });
          fs.renameSync(filePath, retainedPath);
          deletedFiles.push(orphanFile);
        }
      } catch (error) { failedFiles.push({ ...orphanFile, reason: error instanceof Error ? error.message : "删除文件失败。" }); }
      reportProgress(onProgress, 30 + ((index + 1) / Math.max(orphanCount, 1)) * 45, `正在清理未引用文件（${index + 1}/${orphanCount}）...`);
    }
  } finally { if (db.isTransaction) db.exec("ROLLBACK;"); db.close(); }
  return { deletedFiles, failedFiles, recoveryPath: deletedFiles.length ? recoveryPath : null, health: inspectDataFolder(resolvedDataDir, mapProgress(onProgress, 78, 100)) };
}

module.exports = { cleanOrphanFiles, resolveCurrentOrphanFilePath, resolveSafeOrphanPath };
