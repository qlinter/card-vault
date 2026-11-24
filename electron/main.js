const { app, BrowserWindow, dialog, ipcMain, safeStorage, shell, session, powerMonitor } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const { createAiConfigManager } = require("./ai-config");
const { createDesktopLogger } = require("./desktop-logger");
const { createLocalServerRuntime } = require("./local-server-runtime");
const { registerAiIpc } = require("./ipc/ai-ipc");
const { registerStorageIpc } = require("./ipc/storage-ipc");
const { shouldUseSoftwareRendering } = require("./rendering-mode");
const { createStorageManager } = require("./storage");
const { createWindowManager } = require("./window-manager");
const { assertTrustedIpcSender } = require("./ipc/security");

const rootDir = path.resolve(__dirname, "..");

// Keep GPU acceleration enabled by default. Software rendering remains available
// as an explicit compatibility mode for Windows environments with GPU failures.
const softwareRendering = shouldUseSoftwareRendering();
if (softwareRendering) {
  app.disableHardwareAcceleration();
  app.commandLine.appendSwitch("disable-gpu");
  app.commandLine.appendSwitch("in-process-gpu");
}

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
  const developmentUserDataDir = path.join(app.getPath("appData"), "Card Vault Development");
  const userDataDir = canWriteDirectory(developmentUserDataDir)
    ? developmentUserDataDir
    : path.join(rootDir, ".desktop-user-data");
  fs.mkdirSync(userDataDir, { recursive: true });
  app.setPath("userData", userDataDir);
}

configureUserDataPath();
if (process.platform === "win32") app.setAppUserModelId("com.ql.cardvault");

const logger = createDesktopLogger(path.join(app.getPath("userData"), "logs"));
const storage = createStorageManager({ appDataRoot: app.getPath("userData"), projectRoot: rootDir, log: (message) => logger.appendLog("desktop.log", message) });
const aiConfig = createAiConfigManager(path.join(app.getPath("userData"), "ai-config.json"), { isEncryptionAvailable: () => safeStorage.isEncryptionAvailable(), encryptString: (value) => safeStorage.encryptString(value), decryptString: (value) => safeStorage.decryptString(value) });
const runtime = createLocalServerRuntime({ app, rootDir, storage, aiConfig, logger, resolveSystemProxy: url => session.defaultSession.resolveProxy(url) });
const windowManager = createWindowManager({ serverRuntime: runtime, rootDir, logger });

registerStorageIpc({ ipcMain, app, dialog, shell, storage, runtime, logger });
registerAiIpc({ ipcMain, aiConfig, runtime, logger });
ipcMain.handle("card-vault:sign-out-account", async event => {
  assertTrustedIpcSender(event, runtime.getServerUrl());
  await runtime.requireAccount(event);
  try { await runtime.lockAccount(); }
  catch (error) { runtime.stopServer(); logger.appendLog("desktop.log", `Account sign-out failed: ${error.message}`); throw new Error("退出登录未完成，本地访问已停止。请检查账户配置文件后重启应用。"); }
  await event.sender.session.clearCache();
});
async function bootDesktopApp() {
  try {
    logger.ensureLogsDir();
    logger.appendLog("desktop.log", "Desktop app boot started.");
    logger.appendLog("desktop.log", `Rendering mode: ${softwareRendering ? "software compatibility" : "hardware accelerated"}.`);
    logger.appendLog("desktop.log", `User data directory: ${app.getPath("userData")}`);
    await runtime.ensurePreparedBuild();
    await runtime.selectServerTarget();
    await runtime.startServer();
    await runtime.waitForServer(runtime.getServerUrl(), 30000);
    await windowManager.createMainWindow();
    powerMonitor.on("lock-screen", () => {
      windowManager.hideForSystemLock();
      void runtime.lockAccount().then(async () => {
        await session.defaultSession.clearCache();
        await windowManager.loadLockedScreen();
      }).catch(error => {
        runtime.stopServer();
        logger.appendLog("desktop.log", `Account lock failed: ${error.message}`);
        dialog.showErrorBox("Card Vault", "账户锁定未完成，本地访问已停止。请检查账户配置文件的读写权限后重新启动应用。已开始的存储任务会继续完成。");
      });
    });
    powerMonitor.on("unlock-screen", () => windowManager.showLockedScreen());
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
