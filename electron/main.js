const { app, BrowserWindow, dialog, ipcMain } = require("electron");
const fs = require("node:fs");
const { safeStorage, shell } = require("electron");
const http = require("node:http");
const net = require("node:net");
const path = require("node:path");
const { spawn, spawnSync } = require("node:child_process");
const { createAiConfigManager } = require("./ai-config");
const { isSameOriginUrl, normalizeExternalHttpUrl } = require("./navigation");
const { createStorageManager } = require("./storage");

const rootDir = path.resolve(__dirname, "..");
if (process.env.CARD_VAULT_USER_DATA_DIR) {
  app.setPath("userData", path.resolve(process.env.CARD_VAULT_USER_DATA_DIR));
} else if (!app.isPackaged) {
  const legacyUserDataDir = app.getPath("userData");
  const developmentUserDataDir = path.join(app.getPath("appData"), "Card Vault Development");
  fs.mkdirSync(developmentUserDataDir, { recursive: true });
  for (const fileName of ["storage-config.json", "ai-config.json"]) {
    const sourcePath = path.join(legacyUserDataDir, fileName);
    const targetPath = path.join(developmentUserDataDir, fileName);
    if (fs.existsSync(sourcePath) && !fs.existsSync(targetPath)) {
      fs.copyFileSync(sourcePath, targetPath);
    }
  }
  app.setPath("userData", developmentUserDataDir);
}
const logsDir = path.join(rootDir, "logs");
const nextBuildIdPath = path.join(rootDir, ".next", "BUILD_ID");
const nextHealthRoutePath = path.join(rootDir, ".next", "server", "app", "api", "health", "route.js");
const nextCliPath = path.join(rootDir, "node_modules", "next", "dist", "bin", "next");
const initDbScriptPath = path.join(rootDir, "scripts", "init-db.js");
const prepareLocalScriptPath = path.join(rootDir, "scripts", "prepare-local.js");
const storageWorkerPath = path.join(__dirname, "storage-worker.js");
const appIconPath = path.join(rootDir, "build", "icon.ico");
const defaultServerPort = 3000;
let serverPort = defaultServerPort;
let serverUrl = `http://127.0.0.1:${serverPort}`;
const aiConfigPath = path.join(app.getPath("userData"), "ai-config.json");

let mainWindow = null;
let serverProcess = null;
let serverRestartPromise = null;
let activeStorageOperation = null;

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

  if (app.isPackaged) {
    return true;
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
const aiConfig = createAiConfigManager(aiConfigPath, {
  isEncryptionAvailable: () => safeStorage.isEncryptionAvailable(),
  encryptString: (value) => safeStorage.encryptString(value),
  decryptString: (value) => safeStorage.decryptString(value)
});

function getDesktopEnv() {
  return {
    ...storage.getEnv(),
    CARD_VAULT_AI_CONFIG_PATH: aiConfig.getConfigPath(),
    ...aiConfig.getRuntimeEnv()
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

function sendStorageProgress(sender, operation, progress) {
  if (!sender || sender.isDestroyed()) {
    return;
  }
  sender.send("card-vault:storage-progress", {
    operation,
    percent: Math.max(0, Math.min(100, Math.round(progress.percent ?? 0))),
    message: typeof progress.message === "string" ? progress.message : "正在处理...",
    done: Boolean(progress.done)
  });
}

function runStorageWorker(
  sender,
  workerOperation,
  payload = {},
  progressRange = { start: 0, end: 100 },
  displayOperation = workerOperation
) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [storageWorkerPath], {
      cwd: rootDir,
      windowsHide: true,
      env: {
        ...process.env,
        ...storage.getEnv(),
        ELECTRON_RUN_AS_NODE: "1"
      },
      stdio: ["ignore", "pipe", "pipe", "ipc"]
    });
    let settled = false;

    child.stdout.on("data", (chunk) => appendLog("storage-worker.log", chunk.toString().trimEnd()));
    child.stderr.on("data", (chunk) => appendLog("storage-worker.log", chunk.toString().trimEnd()));
    child.on("message", (message) => {
      if (!message || typeof message !== "object") {
        return;
      }
      if (message.type === "progress") {
        const workerPercent = Math.max(0, Math.min(100, Number(message.progress?.percent) || 0));
        const percent = progressRange.start + ((progressRange.end - progressRange.start) * workerPercent) / 100;
        sendStorageProgress(sender, displayOperation, { percent, message: message.progress?.message });
        return;
      }
      if (message.type === "result") {
        settled = true;
        resolve(message.result);
        return;
      }
      if (message.type === "error") {
        settled = true;
        reject(new Error(message.error?.message || "Storage worker failed."));
      }
    });
    child.on("error", (error) => {
      if (!settled) {
        settled = true;
        reject(error);
      }
    });
    child.on("exit", (code) => {
      if (!settled) {
        settled = true;
        reject(new Error(`Storage worker exited with code ${code ?? "unknown"}.`));
      }
    });
    child.send({
      operation: workerOperation,
      payload,
      config: { appDataRoot: app.getPath("userData"), projectRoot: rootDir }
    });
  });
}

async function withStorageOperation(event, operation, callback) {
  if (activeStorageOperation) {
    throw new Error(`存储任务“${activeStorageOperation}”正在执行，请等待完成后重试。`);
  }
  activeStorageOperation = operation;
  sendStorageProgress(event.sender, operation, { percent: 0, message: "正在准备任务..." });
  try {
    return await callback(event.sender);
  } finally {
    sendStorageProgress(event.sender, operation, { percent: 100, message: "任务已结束。", done: true });
    activeStorageOperation = null;
  }
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

async function waitForAvailablePort(port, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await canListenOnPort(port)) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Local service port ${port} is still in use.`);
}

async function selectServerTarget() {
  for (let candidate = defaultServerPort; candidate < defaultServerPort + 20; candidate += 1) {
    if (await canListenOnPort(candidate)) {
      serverPort = candidate;
      serverUrl = `http://127.0.0.1:${serverPort}`;
      return;
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
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (!isLocalAppUrl(url)) {
      openSafeExternalUrl(url);
    }
    return { action: "deny" };
  });

  const guardNavigation = (event, url) => {
    if (isLocalAppUrl(url)) {
      return;
    }
    event.preventDefault();
    openSafeExternalUrl(url);
  };
  mainWindow.webContents.on("will-navigate", guardNavigation);
  mainWindow.webContents.on("will-redirect", guardNavigation);

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  await mainWindow.loadURL(serverUrl);
}

function stopServer() {
  const processToStop = serverProcess;
  serverProcess = null;
  if (processToStop && !processToStop.killed && processToStop.exitCode === null) {
    if (process.platform === "win32" && processToStop.pid) {
      const result = spawnSync("taskkill.exe", ["/pid", String(processToStop.pid), "/t", "/f"], {
        windowsHide: true,
        stdio: "ignore",
        timeout: 5000
      });
      if (result.error || result.status !== 0) {
        try {
          processToStop.kill();
        } catch {
          // The process may have exited while taskkill was running.
        }
      }
    } else {
      try {
        processToStop.kill();
      } catch {
        // The process may already be gone.
      }
    }
  }
  return processToStop;
}

function waitForProcessExit(child, timeoutMs = 5000) {
  if (!child || child.exitCode !== null) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const timeout = setTimeout(resolve, timeoutMs);
    child.once("exit", () => {
      clearTimeout(timeout);
      resolve();
    });
  });
}

async function restartLocalServer() {
  if (serverRestartPromise) {
    return serverRestartPromise;
  }

  serverRestartPromise = (async () => {
    appendLog("desktop.log", "Refreshing local service for updated AI settings.");
    const previousServer = stopServer();
    await waitForProcessExit(previousServer);
    await resumeLocalServer();
    appendLog("desktop.log", "Local service refreshed with updated AI settings.");
  })();

  try {
    await serverRestartPromise;
  } finally {
    serverRestartPromise = null;
  }
}

async function resumeLocalServer() {
  await waitForAvailablePort(serverPort);
  await startServer();
  await waitForServer(serverUrl, 30000);
}

function isLocalAppUrl(rawUrl) {
  return isSameOriginUrl(rawUrl, serverUrl);
}

function openSafeExternalUrl(rawUrl) {
  const externalUrl = normalizeExternalHttpUrl(rawUrl);
  if (!externalUrl) return false;
  void shell.openExternal(externalUrl).catch((error) => {
    appendLog("desktop.log", `Failed to open external URL: ${error.message}`);
  });
  return true;
}

ipcMain.handle("card-vault:choose-storage-directory", async (event) => {
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

    return await withStorageOperation(event, "migrate", async (sender) => {
      let serverWasStopped = false;
      try {
        sendStorageProgress(sender, "migrate", { percent: 1, message: "正在停止本地数据服务..." });
        const child = stopServer();
        serverWasStopped = true;
        await waitForProcessExit(child);
        await waitForAvailablePort(serverPort);

        const migration = await runStorageWorker(
          sender,
          "migrate",
          { selectedPath: result.filePaths[0] },
          { start: 5, end: 100 }
        );
        if (!migration.changed) {
          appendLog("desktop.log", `Storage path unchanged: ${migration.currentPath}`);
          sendStorageProgress(sender, "migrate", { percent: 96, message: "正在恢复本地数据服务..." });
          await resumeLocalServer();
          serverWasStopped = false;
          return { cancelled: false, changed: false, path: migration.currentPath };
        }

        appendLog("desktop.log", `Storage path updated to: ${migration.currentPath}`);
        setTimeout(() => {
          app.relaunch();
          app.quit();
        }, 300);
        return { cancelled: false, changed: true, path: migration.currentPath };
      } catch (error) {
        if (serverWasStopped) {
          try {
            await resumeLocalServer();
          } catch (resumeError) {
            const resumeMessage = resumeError instanceof Error ? resumeError.message : "Unknown server resume error.";
            appendLog("desktop.log", `Failed to resume local service after storage migration error: ${resumeMessage}`);
            setTimeout(() => {
              app.relaunch();
              app.quit();
            }, 300);
          }
        }
        throw error;
      }
    });
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

ipcMain.handle("card-vault:backup-data-folder", async (event) => withStorageOperation(event, "backup", async (sender) => {
  try {
    const result = await runStorageWorker(sender, "backup");
    appendLog("desktop.log", "Data folder backup created: " + result.backupPath);
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown backup error.";
    appendLog("desktop.log", "Data folder backup failed: " + message);
    throw error;
  }
}));

ipcMain.handle("card-vault:check-data-health", async (event) => withStorageOperation(event, "health", async (sender) => {
  try {
    const result = await runStorageWorker(sender, "health");
    appendLog("desktop.log", `Data health check completed: ${result.ok ? "ok" : "issues found"}.`);
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown data health error.";
    appendLog("desktop.log", `Data health check failed: ${message}`);
    throw error;
  }
}));

ipcMain.handle("card-vault:show-orphan-file-in-folder", async (event, file) => {
  try {
    const result = await withStorageOperation(event, "reveal", (sender) =>
      runStorageWorker(sender, "resolveOrphan", { file }, { start: 0, end: 100 }, "reveal")
    );
    const filePath = result.path;
    if (!filePath || !fs.existsSync(filePath)) {
      throw new Error("该文件已不在当前未引用文件列表中，请重新检查数据健康。");
    }

    shell.showItemInFolder(filePath);
    appendLog("desktop.log", `Revealed orphan file in folder: ${filePath}`);
    return { path: filePath };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown orphan file reveal error.";
    appendLog("desktop.log", `Failed to reveal orphan file: ${message}`);
    throw error;
  }
});

ipcMain.handle("card-vault:clean-orphan-files", async (event) => withStorageOperation(event, "cleanup", async (sender) => {
  try {
    const health = await runStorageWorker(sender, "health", {}, { start: 0, end: 35 }, "cleanup");
    if (!health.ok) {
      throw new Error("数据健康检查未通过，暂时不能清理未引用文件。");
    }
    if (health.orphanFiles.length === 0) {
      return { cancelled: false, deletedFiles: [], failedFiles: [], health };
    }

    const visibleFiles = health.orphanFiles.slice(0, 20).map((file) => file.path);
    const remainingCount = health.orphanFiles.length - visibleFiles.length;
    const detail = [
      "即将永久删除以下未被数据库引用的文件：",
      "",
      ...visibleFiles,
      ...(remainingCount > 0 ? [`……以及另外 ${remainingCount} 个文件`] : []),
      "",
      "此操作无法撤销，建议先执行一次一键备份。确认后，程序会再次检查文件是否仍未被引用。"
    ].join("\n");
    const confirmation = await dialog.showMessageBox({
      type: "warning",
      title: "确认清理未引用文件",
      message: `确定清理 ${health.orphanFiles.length} 个未引用文件吗？`,
      detail,
      buttons: ["取消", `清理 ${health.orphanFiles.length} 个文件`],
      defaultId: 0,
      cancelId: 0,
      noLink: true
    });
    if (confirmation.response !== 1) {
      return { cancelled: true, deletedFiles: [], failedFiles: [], health };
    }

    sendStorageProgress(sender, "cleanup", { percent: 38, message: "已确认清理，正在进行删除前复核..." });
    const result = await runStorageWorker(sender, "cleanup", {}, { start: 40, end: 100 });
    appendLog(
      "desktop.log",
      `Orphan cleanup completed: ${result.deletedFiles.length} deleted, ${result.failedFiles.length} failed.`
    );
    return { cancelled: false, ...result };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown orphan cleanup error.";
    appendLog("desktop.log", `Orphan cleanup failed: ${message}`);
    throw error;
  }
}));

ipcMain.handle("card-vault:restore-data-folder", async (event) => withStorageOperation(event, "restore", async (sender) => {
  let serverWasStopped = false;
  try {
    sendStorageProgress(sender, "restore", { percent: 1, message: "请选择要恢复的备份文件夹..." });
    const selected = await dialog.showOpenDialog({
      title: "选择要恢复的数据备份文件夹",
      properties: ["openDirectory"],
      defaultPath: storage.getBackupDir()
    });
    if (selected.canceled || selected.filePaths.length === 0) {
      return { cancelled: true };
    }

    const selectedPath = selected.filePaths[0];
    const preflight = await runStorageWorker(
      sender,
      "restorePreflight",
      { selectedPath },
      { start: 3, end: 30 },
      "restore"
    );
    const sourcePath = preflight.sourcePath;
    const sourceHealth = preflight.health;
    if (sourceHealth.integrity !== "ok") {
      throw new Error("所选文件夹中的 dev.db 未通过完整性检查。");
    }
    const resolvedSourceSummary = path.resolve(selectedPath) === path.resolve(sourcePath)
      ? ""
      : `\n已自动定位到最新备份：${sourcePath}`;
    const issueSummary = sourceHealth.missingFiles.length > 0
      ? `\n\n注意：备份中有 ${sourceHealth.missingFiles.length} 个数据库引用的图片文件缺失。`
      : "";
    sendStorageProgress(sender, "restore", { percent: 31, message: "备份检查完成，等待恢复确认..." });
    const confirmation = await dialog.showMessageBox({
      type: "warning",
      title: "确认恢复备份",
      message: "恢复将替换当前数据目录。程序会先自动备份当前数据，然后重新启动。",
      detail: `恢复来源：${selectedPath}${resolvedSourceSummary}${issueSummary}`,
      buttons: ["取消", "恢复并重启"],
      defaultId: 0,
      cancelId: 0,
      noLink: true
    });
    if (confirmation.response !== 1) {
      return { cancelled: true };
    }

    sendStorageProgress(sender, "restore", { percent: 34, message: "正在停止本地数据服务..." });
    const child = stopServer();
    serverWasStopped = true;
    await waitForProcessExit(child);
    const result = await runStorageWorker(sender, "restore", { sourcePath }, { start: 36, end: 100 });
    appendLog("desktop.log", `Data restored from: ${result.restoredFrom}`);
    setTimeout(() => {
      app.relaunch();
      app.quit();
    }, 300);
    return { cancelled: false, ...result };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown restore error.";
    appendLog("desktop.log", `Data restore failed: ${message}`);
    if (serverWasStopped) {
      setTimeout(() => {
        app.relaunch();
        app.quit();
      }, 500);
    }
    throw error;
  }
}));

ipcMain.handle("card-vault:get-ai-settings", async () => aiConfig.getPublicSettings());

ipcMain.on("card-vault:preload-ready", () => {
  appendLog("desktop.log", "Desktop preload bridge ready.");
});

ipcMain.handle("card-vault:save-ai-settings", async (_event, settings) => {
  try {
    const result = aiConfig.save(settings ?? {});
    appendLog("desktop.log", "Encrypted AI settings saved; applying them to the local service.");
    await restartLocalServer();
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown AI settings error.";
    appendLog("desktop.log", `AI settings save failed: ${message}`);
    throw error;
  }
});

async function bootDesktopApp() {
  try {
    ensureLogsDir();
    appendLog("desktop.log", "Desktop app boot started.");
    appendLog("desktop.log", `User data directory: ${app.getPath("userData")}`);
    if (aiConfig.migrateLegacyConfig()) {
      appendLog("desktop.log", "Legacy AI settings were encrypted with Windows safeStorage.");
    }
    storage.runPendingCleanup();
    await ensurePreparedBuild();

    await selectServerTarget();
    await startServer();
    await waitForServer(serverUrl, 30000);

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
