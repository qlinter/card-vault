const { app, BrowserWindow, dialog, ipcMain, safeStorage, shell } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const { createAiConfigManager } = require("./ai-config");
const { createDesktopLogger } = require("./desktop-logger");
const { createLocalServerRuntime } = require("./local-server-runtime");
const { registerAiIpc } = require("./ipc/ai-ipc");
const { registerStorageIpc } = require("./ipc/storage-ipc");
const { createStorageManager } = require("./storage");
const { createWindowManager } = require("./window-manager");

const rootDir = path.resolve(__dirname, "..");

function configureUserDataPath() {
  if (process.env.CARD_VAULT_USER_DATA_DIR) {
    app.setPath("userData", path.resolve(process.env.CARD_VAULT_USER_DATA_DIR));
    return;
  }
  if (app.isPackaged) return;
  const legacyUserDataDir = app.getPath("userData");
  const developmentUserDataDir = path.join(app.getPath("appData"), "Card Vault Development");
  fs.mkdirSync(developmentUserDataDir, { recursive: true });
  for (const fileName of ["storage-config.json", "ai-config.json"]) {
    const sourcePath = path.join(legacyUserDataDir, fileName);
    const targetPath = path.join(developmentUserDataDir, fileName);
    if (fs.existsSync(sourcePath) && !fs.existsSync(targetPath)) fs.copyFileSync(sourcePath, targetPath);
  }
  app.setPath("userData", developmentUserDataDir);
}

configureUserDataPath();
if (process.platform === "win32") app.setAppUserModelId("com.ql.cardvault");

const logger = createDesktopLogger(path.join(rootDir, "logs"));
const storage = createStorageManager({ appDataRoot: app.getPath("userData"), projectRoot: rootDir, log: (message) => logger.appendLog("desktop.log", message) });
const aiConfig = createAiConfigManager(path.join(app.getPath("userData"), "ai-config.json"), { isEncryptionAvailable: () => safeStorage.isEncryptionAvailable(), encryptString: (value) => safeStorage.encryptString(value), decryptString: (value) => safeStorage.decryptString(value) });
const runtime = createLocalServerRuntime({ app, rootDir, storage, aiConfig, logger });
const windowManager = createWindowManager({ app, serverRuntime: runtime, rootDir, logger });

registerStorageIpc({ ipcMain, app, dialog, shell, storage, runtime, logger });
registerAiIpc({ ipcMain, aiConfig, runtime, logger });

async function bootDesktopApp() {
  try {
    logger.ensureLogsDir();
    logger.appendLog("desktop.log", "Desktop app boot started.");
    logger.appendLog("desktop.log", `User data directory: ${app.getPath("userData")}`);
    if (aiConfig.migrateLegacyConfig()) logger.appendLog("desktop.log", "Legacy AI settings were encrypted with Windows safeStorage.");
    storage.runPendingCleanup();
    await runtime.ensurePreparedBuild();
    await runtime.selectServerTarget();
    await runtime.startServer();
    await runtime.waitForServer(runtime.getServerUrl(), 30000);
    await windowManager.createMainWindow();
    logger.appendLog("desktop.log", "Desktop app boot completed.");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown startup error.";
    logger.appendLog("desktop.log", `Startup failed: ${message}`);
    dialog.showErrorBox("Card Vault Local", `${message}\n\nCheck the logs folder for details.`);
    app.quit();
  }
}

const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (hasSingleInstanceLock) app.whenReady().then(bootDesktopApp);
else app.quit();

app.on("second-instance", () => windowManager.focusMainWindow());
app.on("window-all-closed", () => { runtime.stopServer(); app.quit(); });
app.on("before-quit", () => runtime.stopServer());
app.on("activate", async () => { if (BrowserWindow.getAllWindows().length === 0) await windowManager.createMainWindow(); });
