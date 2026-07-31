const { app, BrowserWindow, dialog, ipcMain } = require("electron");
const fs = require("node:fs");
const http = require("node:http");
const net = require("node:net");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { createAiConfigManager } = require("./ai-config");
const { createStorageManager } = require("./storage");

const rootDir = path.resolve(__dirname, "..");
const logsDir = path.join(rootDir, "logs");
const nextBuildIdPath = path.join(rootDir, ".next", "BUILD_ID");
const nextHealthRoutePath = path.join(rootDir, ".next", "server", "app", "api", "health", "route.js");
const nextCliPath = path.join(rootDir, "node_modules", "next", "dist", "bin", "next");
const initDbScriptPath = path.join(rootDir, "scripts", "init-db.js");
const prepareLocalScriptPath = path.join(rootDir, "scripts", "prepare-local.js");
const appIconPath = path.join(rootDir, "build", "icon.ico");
const defaultServerPort = 3000;
let serverPort = defaultServerPort;
let serverUrl = `http://127.0.0.1:${serverPort}`;
const aiConfigPath = path.join(app.getPath("userData"), "ai-config.json");

let mainWindow = null;
let serverProcess = null;

if (process.platform === "win32") {
  app.setAppUserModelId("com.ql.cardvault");
}

const hasSingleInstanceLock = app.requestSingleInstanceLock();

const nextBuildSourcePaths = [
  path.join(rootDir, "app"),
  path.join(rootDir, "components"),
  path.join(rootDir, "lib"),
  path.join(rootDir, "next.config.mjs"),
  path.join(rootDir, "package.json"),
  path.join(rootDir, "postcss.config.mjs"),
  path.join(rootDir, "prisma", "schema.prisma"),
  path.join(rootDir, "tailwind.config.ts")
];

function getLatestModifiedTime(targetPath) {
  if (!fs.existsSync(targetPath)) {
    return 0;
  }

  const stats = fs.statSync(targetPath);
  if (!stats.isDirectory()) {
    return stats.mtimeMs;
  }

  return fs.readdirSync(targetPath, { withFileTypes: true }).reduce((latest, entry) => {
    return Math.max(latest, getLatestModifiedTime(path.join(targetPath, entry.name)));
  }, stats.mtimeMs);
}

function isPreparedBuildCurrent() {
  if (!fs.existsSync(nextBuildIdPath) || !fs.existsSync(nextHealthRoutePath)) {
    return false;
  }

  const buildTime = fs.statSync(nextBuildIdPath).mtimeMs;
  const latestSourceTime = nextBuildSourcePaths.reduce((latest, sourcePath) => {
    return Math.max(latest, getLatestModifiedTime(sourcePath));
  }, 0);

  return buildTime >= latestSourceTime;
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

function checkCardVaultServer(url) {
  return new Promise((resolve) => {
    const request = http.get(`${url}/api/health`, (response) => {
      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => {
        body += chunk;
      });
      response.on("end", () => {
        try {
          const payload = JSON.parse(body);
          resolve(response.statusCode === 200 && payload.app === "card-vault");
        } catch {
          resolve(false);
        }
      });
    });

    request.setTimeout(1500, () => request.destroy());
    request.on("error", () => resolve(false));
  });
}

function waitForServer(url, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();

    const attempt = async () => {
      if (await checkCardVaultServer(url)) {
        resolve();
        return;
      }
      if (Date.now() - startedAt >= timeoutMs) {
        reject(new Error(`Timed out waiting for ${url}`));
        return;
      }

      setTimeout(attempt, 500);
    };

    attempt();
  });
}

function canListenOnPort(port) {
  return new Promise((resolve) => {
    const probe = net.createServer();
    probe.unref();
    probe.once("error", () => resolve(false));
    probe.listen({ host: "127.0.0.1", port }, () => {
      probe.close(() => resolve(true));
    });
  });
}

async function selectServerTarget() {
  const defaultUrl = `http://127.0.0.1:${defaultServerPort}`;
  if (await checkCardVaultServer(defaultUrl)) {
    serverPort = defaultServerPort;
    serverUrl = defaultUrl;
    return { reuse: true };
  }

  for (let candidate = defaultServerPort; candidate < defaultServerPort + 20; candidate += 1) {
    if (await canListenOnPort(candidate)) {
      serverPort = candidate;
      serverUrl = `http://127.0.0.1:${serverPort}`;
      return { reuse: false };
    }
  }

  throw new Error("No available local port found for Card Vault.");
}

async function ensurePreparedBuild() {
  if (isPreparedBuildCurrent()) {
    appendLog("desktop.log", "Existing build found.");
    return;
  }

  appendLog("desktop.log", "Build missing or stale; preparing local app build.");
  await runNodeCommand(prepareLocalScriptPath, [], "prepare.log");
}

async function startServer() {
  appendLog("desktop.log", "Starting local Next server.");
  const dataDir = storage.getDataDir();
  const uploadsDir = storage.getUploadsDir();
  const shareCoversDir = storage.getShareCoversDir();
  const shareBackgroundsDir = storage.getShareBackgroundsDir();
  const dbPath = storage.getDbPath();

  storage.repairDataLayout(dataDir);
  fs.mkdirSync(dataDir, { recursive: true });
  fs.mkdirSync(uploadsDir, { recursive: true });
  fs.mkdirSync(shareCoversDir, { recursive: true });
  fs.mkdirSync(shareBackgroundsDir, { recursive: true });
  await runNodeCommand(initDbScriptPath, [], "prepare.log");

  serverProcess = spawn(process.execPath, [nextCliPath, "start", "--hostname", "127.0.0.1", "--port", String(serverPort)], {
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

ipcMain.handle("card-vault:get-backup-settings", async () => storage.getBackupSettings());

ipcMain.handle("card-vault:choose-backup-directory", async () => {
  try {
    const result = await dialog.showOpenDialog({
      title: "\u9009\u62e9\u5907\u4efd\u4fdd\u5b58\u8def\u5f84",
      properties: ["openDirectory", "createDirectory"],
      defaultPath: storage.getBackupDir()
    });

    if (result.canceled || result.filePaths.length === 0) {
      appendLog("desktop.log", "Backup path change cancelled.");
      return { cancelled: true, path: storage.getBackupDir() };
    }

    const backup = storage.chooseBackupDir(result.filePaths[0]);
    appendLog("desktop.log", "Backup path updated to: " + backup.path);
    return { cancelled: false, path: backup.path };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown backup path error.";
    appendLog("desktop.log", "Backup path update failed: " + message);
    throw error;
  }
});

ipcMain.handle("card-vault:backup-data-folder", async () => {
  try {
    const result = storage.backupDataFolder();
    appendLog("desktop.log", "Data folder backup created: " + result.backupPath);
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown backup error.";
    appendLog("desktop.log", "Data folder backup failed: " + message);
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

    const serverTarget = await selectServerTarget();
    if (!serverTarget.reuse) {
      await startServer();
      await waitForServer(serverUrl, 30000);
    } else {
      appendLog("desktop.log", `Reusing verified Card Vault server: ${serverUrl}`);
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

if (hasSingleInstanceLock) {
  app.whenReady().then(bootDesktopApp);
} else {
  app.quit();
}

app.on("second-instance", () => {
  if (!mainWindow) {
    return;
  }

  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }
  mainWindow.show();
  mainWindow.focus();
});

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
