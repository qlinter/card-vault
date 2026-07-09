const { app, BrowserWindow, dialog, ipcMain } = require("electron");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { createAiConfigManager } = require("./ai-config");
const { createStorageManager } = require("./storage");

const rootDir = path.resolve(__dirname, "..");
const logsDir = path.join(rootDir, "logs");
const nextBuildIdPath = path.join(rootDir, ".next", "BUILD_ID");
const nextCliPath = path.join(rootDir, "node_modules", "next", "dist", "bin", "next");
const initDbScriptPath = path.join(rootDir, "scripts", "init-db.js");
const prepareLocalScriptPath = path.join(rootDir, "scripts", "prepare-local.js");
const appIconPath = path.join(rootDir, "build", "icon.ico");
const serverUrl = "http://127.0.0.1:3000";
const aiConfigPath = path.join(app.getPath("userData"), "ai-config.json");

let mainWindow = null;
let serverProcess = null;

if (process.platform === "win32") {
  app.setAppUserModelId("com.ql.cardvault");
}

function ensureLogsDir() {
  fs.mkdirSync(logsDir, { recursive: true });
}

function appendLog(fileName, message) {
  ensureLogsDir();
  if (!message) {
    return;
  }

  fs.appendFileSync(path.join(logsDir, fileName), `${new Date().toISOString()} ${message}\n`);
}

const storage = createStorageManager({
  appDataRoot: app.getPath("userData"),
  projectRoot: rootDir,
  log: (message) => appendLog("desktop.log", message)
});
const aiConfig = createAiConfigManager(aiConfigPath);

function getDesktopEnv() {
  return {
    ...storage.getEnv(),
    CARD_VAULT_AI_CONFIG_PATH: aiConfig.getConfigPath()
  };
}

function runNodeCommand(scriptPath, args, logFile) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [scriptPath, ...args], {
      cwd: rootDir,
      windowsHide: true,
      env: {
        ...process.env,
        ...getDesktopEnv(),
        ELECTRON_RUN_AS_NODE: "1"
      }
    });

    child.stdout.on("data", (chunk) => {
      appendLog(logFile, chunk.toString().trimEnd());
    });

    child.stderr.on("data", (chunk) => {
      appendLog(logFile, chunk.toString().trimEnd());
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${path.basename(scriptPath)} ${args.join(" ")} exited with code ${code ?? "unknown"}.`));
    });
  });
}

function waitForServer(url, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();

    const attempt = () => {
      const request = http.get(url, (response) => {
        response.resume();
        resolve();
      });

      request.on("error", () => {
        if (Date.now() - startedAt >= timeoutMs) {
          reject(new Error(`Timed out waiting for ${url}`));
          return;
        }

        setTimeout(attempt, 1000);
      });
    };

    attempt();
  });
}

async function isServerReachable(url) {
  try {
    await waitForServer(url, 2000);
    return true;
  } catch {
    return false;
  }
}

async function ensurePreparedBuild() {
  if (fs.existsSync(nextBuildIdPath)) {
    appendLog("desktop.log", "Existing build found.");
    return;
  }

  appendLog("desktop.log", "Preparing local app build.");
  await runNodeCommand(prepareLocalScriptPath, [], "prepare.log");
}

async function startServer() {
  appendLog("desktop.log", "Starting local Next server.");
  const dataDir = storage.getDataDir();
  const uploadsDir = storage.getUploadsDir();
  const shareCoversDir = storage.getShareCoversDir();
  const dbPath = storage.getDbPath();

  storage.repairDataLayout(dataDir);
  fs.mkdirSync(dataDir, { recursive: true });
  fs.mkdirSync(uploadsDir, { recursive: true });
  fs.mkdirSync(shareCoversDir, { recursive: true });
  await runNodeCommand(initDbScriptPath, [], "prepare.log");

  serverProcess = spawn(process.execPath, [nextCliPath, "start", "--hostname", "127.0.0.1", "--port", "3000"], {
    cwd: rootDir,
    windowsHide: true,
    env: {
      ...process.env,
      ...getDesktopEnv(),
      ELECTRON_RUN_AS_NODE: "1",
      DATABASE_URL: `file:${dbPath.replace(/\\/g, "/")}`
    }
  });

  serverProcess.stdout.on("data", (chunk) => {
    appendLog("server.log", chunk.toString().trimEnd());
  });

  serverProcess.stderr.on("data", (chunk) => {
    appendLog("server.log", chunk.toString().trimEnd());
  });

  serverProcess.on("error", (error) => {
    appendLog("desktop.log", `Server process error: ${error.message}`);
  });

  serverProcess.on("exit", (code) => {
    appendLog("desktop.log", `Server exited with code ${code ?? "unknown"}.`);
  });
}

async function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1100,
    minHeight: 760,
    backgroundColor: "#10131a",
    autoHideMenuBar: true,
    show: false,
    title: "Card Vault",
    icon: appIconPath,
    webPreferences: {
      preload: path.join(__dirname, "preload.js")
    }
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  await mainWindow.loadURL(serverUrl);
}

function stopServer() {
  if (serverProcess && !serverProcess.killed) {
    serverProcess.kill();
    serverProcess = null;
  }
}

ipcMain.handle("card-vault:choose-storage-directory", async () => {
  try {
    const result = await dialog.showOpenDialog({
      title: "选择卡片资料存储路径",
      properties: ["openDirectory", "createDirectory"],
      defaultPath: storage.getDataDir()
    });

    if (result.canceled || result.filePaths.length === 0) {
      appendLog("desktop.log", "Storage path change cancelled.");
      return { cancelled: true, changed: false, path: storage.getDataDir() };
    }

    const migration = storage.migrateTo(result.filePaths[0]);
    if (!migration.changed) {
      appendLog("desktop.log", `Storage path unchanged: ${migration.currentPath}`);
      return { cancelled: false, changed: false, path: migration.currentPath };
    }

    appendLog("desktop.log", `Storage path updated to: ${migration.currentPath}`);

    setTimeout(() => {
      stopServer();
      app.relaunch();
      app.quit();
    }, 300);

    return { cancelled: false, changed: true, path: migration.currentPath };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown storage path error.";
    appendLog("desktop.log", `Storage path update failed: ${message}`);
    throw error;
  }
});

ipcMain.handle("card-vault:get-ai-settings", async () => aiConfig.getPublicSettings());

ipcMain.handle("card-vault:save-ai-settings", async (_event, settings) => {
  try {
    const result = aiConfig.save(settings ?? {});
    appendLog("desktop.log", "Azure OpenAI settings saved.");
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Azure OpenAI settings error.";
    appendLog("desktop.log", `Azure OpenAI settings save failed: ${message}`);
    throw error;
  }
});

async function bootDesktopApp() {
  try {
    ensureLogsDir();
    appendLog("desktop.log", "Desktop app boot started.");
    storage.runPendingCleanup();
    await ensurePreparedBuild();

    if (!(await isServerReachable(serverUrl))) {
      await startServer();
      await waitForServer(serverUrl, 30000);
    } else {
      appendLog("desktop.log", "Reusing existing local server.");
    }

    await createMainWindow();
    appendLog("desktop.log", "Desktop app boot completed.");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown startup error.";
    appendLog("desktop.log", `Startup failed: ${message}`);
    dialog.showErrorBox("Card Vault Local", `${message}\n\nCheck the logs folder for details.`);
    app.quit();
  }
}

app.whenReady().then(bootDesktopApp);

app.on("window-all-closed", () => {
  stopServer();
  app.quit();
});

app.on("before-quit", () => {
  stopServer();
});

app.on("activate", async () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    await createMainWindow();
  }
});


