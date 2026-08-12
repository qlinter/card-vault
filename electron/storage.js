const { createBackupService } = require("./storage/backup");
const { createStorageConfig } = require("./storage/config");
const { inspectDataFolder } = require("./storage/health");
const { createMigrationService } = require("./storage/migration");
const { cleanOrphanFiles, resolveCurrentOrphanFilePath } = require("./storage/orphan-files");
const { createRestoreService, resolveRestoreSourcePath } = require("./storage/restore");

/**
 * Stable facade for Electron main process and storage-worker callers.
 * The implementation is split by data-safety boundary, while this public
 * factory keeps the existing storage API and worker protocol unchanged.
 */
function createStorageManager({ appDataRoot, projectRoot, log }) {
  const config = createStorageConfig({ appDataRoot, projectRoot });
  const repairDataLayout = config.repairDataLayout;
  const inspect = (dataDir = config.getDataDir(), onProgress) => inspectDataFolder(dataDir, onProgress);
  const { chooseBackupDir, backupDataFolder } = createBackupService({ config, repairDataLayout });
  const { migrateTo } = createMigrationService({ config, inspectDataFolder: inspect, repairDataLayout });
  const { restoreDataFolder } = createRestoreService({ config, backupDataFolder, repairDataLayout });

  function runPendingCleanup() {
    const pendingDeleteDir = config.loadCleanupConfig().pendingDeleteDir;
    if (!pendingDeleteDir) return;
    try {
      config.clearCleanupConfig();
      log(`Pending storage cleanup cancelled to preserve data: ${pendingDeleteDir}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown cleanup error.";
      log(`Failed to cancel pending storage cleanup: ${message}`);
    }
  }

  return {
    getDataDir: config.getDataDir,
    getBackupDir: config.getBackupDir,
    getUploadsDir: config.getUploadsDir,
    getShareCoversDir: config.getShareCoversDir,
    getShareBackgroundsDir: config.getShareBackgroundsDir,
    getDbPath: config.getDbPath,
    getEnv: config.getEnv,
    repairDataLayout,
    chooseBackupDir,
    backupDataFolder,
    resolveRestoreSourcePath,
    inspectDataFolder: inspect,
    resolveOrphanFilePath: (orphanFile, onProgress) => resolveCurrentOrphanFilePath(config.getDataDir(), orphanFile, onProgress),
    cleanOrphanFiles: (onProgress) => cleanOrphanFiles(config.getDataDir(), onProgress),
    restoreDataFolder,
    getBackupSettings: () => ({ path: config.getBackupDir() }),
    migrateTo,
    runPendingCleanup
  };
}

module.exports = { createStorageManager };
