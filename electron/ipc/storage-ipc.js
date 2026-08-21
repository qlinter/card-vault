const fs = require("node:fs");
const path = require("node:path");
const { createStorageWorkerBridge } = require("./storage-worker-bridge");
const { createTrustedIpcRegistrar } = require("./security");

function registerStorageIpc({ ipcMain, app, dialog, shell, storage, runtime, logger }) {
  const { sendStorageProgress, runStorageWorker, withStorageOperation } = createStorageWorkerBridge({ app, runtime, storage, logger });
  const trustedHandle = createTrustedIpcRegistrar(ipcMain, () => runtime.getServerUrl());

  trustedHandle("card-vault:choose-storage-directory", async (event) => {
    try {
      const result = await dialog.showOpenDialog({ title: "选择卡片资料存储路径", properties: ["openDirectory", "createDirectory"], defaultPath: storage.getDataDir() });
      if (result.canceled || result.filePaths.length === 0) { logger.appendLog("desktop.log", "Storage path change cancelled."); return { cancelled: true, changed: false, path: storage.getDataDir() }; }
      return await withStorageOperation(event, "migrate", async (sender) => {
        let serverWasStopped = false;
        try {
          sendStorageProgress(sender, "migrate", { percent: 1, message: "正在停止本地数据服务..." });
          const child = runtime.stopServer(); serverWasStopped = true; await runtime.waitForProcessExit(child); await runtime.waitForAvailablePort(runtime.getServerPort());
          const migration = await runStorageWorker(sender, "migrate", { selectedPath: result.filePaths[0] }, { start: 5, end: 100 });
          if (!migration.changed) { logger.appendLog("desktop.log", `Storage path unchanged: ${migration.currentPath}`); sendStorageProgress(sender, "migrate", { percent: 96, message: "正在恢复本地数据服务..." }); await runtime.resumeLocalServer(); serverWasStopped = false; return { cancelled: false, changed: false, path: migration.currentPath }; }
          logger.appendLog("desktop.log", `Storage path updated to: ${migration.currentPath}`); setTimeout(() => { app.relaunch(); app.quit(); }, 300); return { cancelled: false, changed: true, path: migration.currentPath };
        } catch (error) {
          if (serverWasStopped) { try { await runtime.resumeLocalServer(); } catch (resumeError) { logger.appendLog("desktop.log", `Failed to resume local service after storage migration error: ${resumeError instanceof Error ? resumeError.message : "Unknown server resume error."}`); setTimeout(() => { app.relaunch(); app.quit(); }, 300); } }
          throw error;
        }
      });
    } catch (error) { logger.appendLog("desktop.log", `Storage path update failed: ${error instanceof Error ? error.message : "Unknown storage path error."}`); throw error; }
  });

  trustedHandle("card-vault:get-backup-settings", async () => storage.getBackupSettings());
  trustedHandle("card-vault:choose-backup-directory", async () => {
    try {
      const result = await dialog.showOpenDialog({ title: "选择备份保存路径", properties: ["openDirectory", "createDirectory"], defaultPath: storage.getBackupDir() });
      if (result.canceled || result.filePaths.length === 0) { logger.appendLog("desktop.log", "Backup path change cancelled."); return { cancelled: true, path: storage.getBackupDir() }; }
      const backup = storage.chooseBackupDir(result.filePaths[0]); logger.appendLog("desktop.log", `Backup path updated to: ${backup.path}`); return { cancelled: false, path: backup.path };
    } catch (error) { logger.appendLog("desktop.log", `Backup path update failed: ${error instanceof Error ? error.message : "Unknown backup path error."}`); throw error; }
  });
  trustedHandle("card-vault:backup-data-folder", async (event) => withStorageOperation(event, "backup", async (sender) => { try { const result = await runStorageWorker(sender, "backup"); logger.appendLog("desktop.log", `Data folder backup created: ${result.backupPath}`); return result; } catch (error) { logger.appendLog("desktop.log", `Data folder backup failed: ${error instanceof Error ? error.message : "Unknown backup error."}`); throw error; } }));
  trustedHandle("card-vault:check-data-health", async (event) => withStorageOperation(event, "health", async (sender) => { try { const result = await runStorageWorker(sender, "health"); logger.appendLog("desktop.log", `Data health check completed: ${result.ok ? "ok" : "issues found"}.`); return result; } catch (error) { logger.appendLog("desktop.log", `Data health check failed: ${error instanceof Error ? error.message : "Unknown data health error."}`); throw error; } }));
  trustedHandle("card-vault:show-orphan-file-in-folder", async (event, file) => {
    try {
      const result = await withStorageOperation(event, "reveal", (sender) => runStorageWorker(sender, "resolveOrphan", { file }, { start: 0, end: 100 }, "reveal"));
      if (!result.path || !fs.existsSync(result.path)) throw new Error("该文件已不在当前未引用文件列表中，请重新检查数据健康。");
      shell.showItemInFolder(result.path); logger.appendLog("desktop.log", `Revealed orphan file in folder: ${result.path}`); return { path: result.path };
    } catch (error) { logger.appendLog("desktop.log", `Failed to reveal orphan file: ${error instanceof Error ? error.message : "Unknown orphan file reveal error."}`); throw error; }
  });
  trustedHandle("card-vault:clean-orphan-files", async (event) => withStorageOperation(event, "cleanup", async (sender) => {
    try {
      const health = await runStorageWorker(sender, "health", {}, { start: 0, end: 35 }, "cleanup");
      if (!health.ok) throw new Error("数据健康检查未通过，暂时不能清理未引用文件。");
      if (health.orphanFiles.length === 0) return { cancelled: false, deletedFiles: [], failedFiles: [], health };
      const visibleFiles = health.orphanFiles.slice(0, 20).map((file) => file.path); const remainingCount = health.orphanFiles.length - visibleFiles.length;
      const detail = ["即将永久删除以下未被数据库引用的文件：", "", ...visibleFiles, ...(remainingCount > 0 ? [`……以及另外 ${remainingCount} 个文件`] : []), "", "此操作无法撤销，建议先执行一次一键备份。确认后，程序会再次检查文件是否仍未被引用。"].join("\n");
      const confirmation = await dialog.showMessageBox({ type: "warning", title: "确认清理未引用文件", message: `确定清理 ${health.orphanFiles.length} 个未引用文件吗？`, detail, buttons: ["取消", `清理 ${health.orphanFiles.length} 个文件`], defaultId: 0, cancelId: 0, noLink: true });
      if (confirmation.response !== 1) return { cancelled: true, deletedFiles: [], failedFiles: [], health };
      sendStorageProgress(sender, "cleanup", { percent: 38, message: "已确认清理，正在进行删除前复核..." });
      const result = await runStorageWorker(sender, "cleanup", {}, { start: 40, end: 100 }); logger.appendLog("desktop.log", `Orphan cleanup completed: ${result.deletedFiles.length} deleted, ${result.failedFiles.length} failed.`); return { cancelled: false, ...result };
    } catch (error) { logger.appendLog("desktop.log", `Orphan cleanup failed: ${error instanceof Error ? error.message : "Unknown orphan cleanup error."}`); throw error; }
  }));
  trustedHandle("card-vault:restore-data-folder", async (event) => withStorageOperation(event, "restore", async (sender) => {
    let serverWasStopped = false;
    try {
      sendStorageProgress(sender, "restore", { percent: 1, message: "请选择要恢复的备份文件夹..." });
      const selected = await dialog.showOpenDialog({ title: "选择要恢复的数据备份文件夹", properties: ["openDirectory"], defaultPath: storage.getBackupDir() });
      if (selected.canceled || selected.filePaths.length === 0) return { cancelled: true };
      const selectedPath = selected.filePaths[0];
      const preflight = await runStorageWorker(sender, "restorePreflight", { selectedPath }, { start: 3, end: 30 }, "restore");
      if (preflight.health.integrity !== "ok") throw new Error("所选文件夹中的 dev.db 未通过完整性检查。");
      const resolvedSourceSummary = path.resolve(selectedPath) === path.resolve(preflight.sourcePath) ? "" : `\n已自动定位到最新备份：${preflight.sourcePath}`;
      const issueSummary = preflight.health.missingFiles.length > 0 ? `\n\n注意：备份中有 ${preflight.health.missingFiles.length} 个数据库引用的图片文件缺失。` : "";
      sendStorageProgress(sender, "restore", { percent: 31, message: "备份检查完成，等待恢复确认..." });
      const confirmation = await dialog.showMessageBox({ type: "warning", title: "确认恢复备份", message: "恢复将替换当前数据目录。程序会先自动备份当前数据，然后重新启动。", detail: `恢复来源：${selectedPath}${resolvedSourceSummary}${issueSummary}`, buttons: ["取消", "恢复并重启"], defaultId: 0, cancelId: 0, noLink: true });
      if (confirmation.response !== 1) return { cancelled: true };
      sendStorageProgress(sender, "restore", { percent: 34, message: "正在停止本地数据服务..." }); const child = runtime.stopServer(); serverWasStopped = true; await runtime.waitForProcessExit(child);
      const result = await runStorageWorker(sender, "restore", { sourcePath: preflight.sourcePath }, { start: 36, end: 100 }); logger.appendLog("desktop.log", `Data restored from: ${result.restoredFrom}`); setTimeout(() => { app.relaunch(); app.quit(); }, 300); return { cancelled: false, ...result };
    } catch (error) { logger.appendLog("desktop.log", `Data restore failed: ${error instanceof Error ? error.message : "Unknown restore error."}`); if (serverWasStopped) setTimeout(() => { app.relaunch(); app.quit(); }, 500); throw error; }
  }));
}

module.exports = { registerStorageIpc };
