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

// Some Windows environments cannot load Electron's GPU subprocess dependencies.
// Disable hardware acceleration before app startup so this does not prevent the
// local server and desktop window from launching.
app.disableHardwareAcceleration();
app.commandLine.appendSwitch("disable-gpu");
app.commandLine.appendSwitch("in-process-gpu");

function canWriteDirectory(directory) {
  try {
    fs.mkdirSync(directory, { recursive: true });
    const probePath = path.join(directory, `.write-probe-${process.pid}`);
    fs.writeFileSync(probePath, "ok");
    fs.rmSync(probePath, { force: true });
    return true;
  } catch {
    return false;
  }
}

function configureUserDataPath() {
  if (process.env.CARD_VAULT_USER_DATA_DIR) {
    app.setPath("userData", path.resolve(process.env.CARD_VAULT_USER_DATA_DIR));
    return;
  }
  if (app.isPackaged) return;
  const legacyUserDataDir = app.getPath("userData");
  const developmentUserDataDir = path.join(app.getPath("appData"), "Card Vault Development");
  const userDataDir = canWriteDirectory(developmentUserDataDir)
    ? developmentUserDataDir
    : path.join(rootDir, ".desktop-user-data");
  fs.mkdirSync(userDataDir, { recursive: true });
  for (const fileName of ["storage-config.json", "ai-config.json"]) {
    const targetPath = path.join(userDataDir, fileName);
    if (fs.existsSync(targetPath)) continue;
    for (const sourceDir of [developmentUserDataDir, legacyUserDataDir]) {
      const sourcePath = path.join(sourceDir, fileName);
      if (!fs.existsSync(sourcePath)) continue;
      fs.copyFileSync(sourcePath, targetPath);
      break;
    }
  }
  app.setPath("userData", userDataDir);
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
