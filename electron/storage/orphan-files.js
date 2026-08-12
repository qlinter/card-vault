const fs = require("node:fs");
const path = require("node:path");
const { inspectDataFolder } = require("./health");
const { mapProgress, reportProgress } = require("./progress");

const orphanDirectoryByType = { cardImage: "uploads", shareCover: "share-covers", shareBackground: "share-backgrounds" };

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
  const orphanCount = healthBeforeCleanup.orphanFiles.length;
  for (const [index, orphanFile] of healthBeforeCleanup.orphanFiles.entries()) {
    const filePath = resolveSafeOrphanPath(resolvedDataDir, orphanFile);
    if (!filePath) { failedFiles.push({ ...orphanFile, reason: "文件路径不在允许清理的媒体目录中。" }); continue; }
    try {
      if (fs.existsSync(filePath)) { fs.rmSync(filePath, { force: true }); deletedFiles.push(orphanFile); }
    } catch (error) { failedFiles.push({ ...orphanFile, reason: error instanceof Error ? error.message : "删除文件失败。" }); }
    reportProgress(onProgress, 30 + ((index + 1) / Math.max(orphanCount, 1)) * 45, `正在清理未引用文件（${index + 1}/${orphanCount}）...`);
  }
  return { deletedFiles, failedFiles, health: inspectDataFolder(resolvedDataDir, mapProgress(onProgress, 78, 100)) };
}

module.exports = { cleanOrphanFiles, resolveCurrentOrphanFilePath, resolveSafeOrphanPath };
