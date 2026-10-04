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
function createStorageManager({ appDataRoot, projectRoot }) {
  const config = createStorageConfig({ appDataRoot, projectRoot });
  const ensureDataLayout = config.ensureDataLayout;
  const inspect = (dataDir = config.getDataDir(), onProgress) => inspectDataFolder(dataDir, onProgress);
  const { chooseBackupDir, backupDataFolder } = createBackupService({ config, ensureDataLayout });
  const { migrateTo } = createMigrationService({ config, inspectDataFolder: inspect, ensureDataLayout });
  const { restoreDataFolder } = createRestoreService({ config, backupDataFolder, ensureDataLayout });

  return {
    getDataDir: config.getDataDir,
    getBackupDir: config.getBackupDir,
    getUploadsDir: config.getUploadsDir,
    getThumbnailsDir: config.getThumbnailsDir,
    getShareCoversDir: config.getShareCoversDir,
    getShareBackgroundsDir: config.getShareBackgroundsDir,
    getDbPath: config.getDbPath,
    getEnv: config.getEnv,
    ensureDataLayout,
    chooseBackupDir,
    backupDataFolder,
    resolveRestoreSourcePath,
    inspectDataFolder: inspect,
    resolveOrphanFilePath: (orphanFile, onProgress) => resolveCurrentOrphanFilePath(config.getDataDir(), orphanFile, onProgress),
    cleanOrphanFiles: (onProgress) => cleanOrphanFiles(config.getDataDir(), onProgress),
    restoreDataFolder,
    getBackupSettings: () => ({ path: config.getBackupDir() }),
    migrateTo
  };
}

module.exports = { createStorageManager };
