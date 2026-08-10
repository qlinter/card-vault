const { createStorageManager } = require("./storage");

function requireString(value, label) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${label} is required.`);
  }
  return value;
}

function createTaskStorage(config) {
  return createStorageManager({
    appDataRoot: requireString(config?.appDataRoot, "appDataRoot"),
    projectRoot: requireString(config?.projectRoot, "projectRoot"),
    log: () => {}
  });
}

function runStorageTask(request, reportProgress = () => {}) {
  const storage = createTaskStorage(request?.config);
  const payload = request?.payload || {};

  switch (request?.operation) {
    case "backup":
      return storage.backupDataFolder(reportProgress);
    case "health":
      return storage.inspectDataFolder(payload.dataDir || storage.getDataDir(), reportProgress);
    case "cleanup":
      return storage.cleanOrphanFiles(reportProgress);
    case "resolveOrphan":
      return { path: storage.resolveOrphanFilePath(payload.file, reportProgress) };
    case "migrate":
      return storage.migrateTo(requireString(payload.selectedPath, "selectedPath"), reportProgress);
    case "restorePreflight": {
      reportProgress({ percent: 2, message: "正在定位所选备份..." });
      const sourcePath = storage.resolveRestoreSourcePath(requireString(payload.selectedPath, "selectedPath"));
      if (!sourcePath) {
        throw new Error("所选文件夹中未找到可恢复的 dev.db。请选择一键备份生成的日期文件夹或其中的 data 文件夹。");
      }
      const health = storage.inspectDataFolder(sourcePath, reportProgress);
      return { sourcePath, health };
    }
    case "restore":
      return storage.restoreDataFolder(requireString(payload.sourcePath, "sourcePath"), reportProgress);
    default:
      throw new Error(`Unsupported storage operation: ${String(request?.operation || "")}`);
  }
}

module.exports = { runStorageTask };
