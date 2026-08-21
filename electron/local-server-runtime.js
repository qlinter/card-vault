const fs = require("node:fs");
const { randomBytes } = require("node:crypto");
const http = require("node:http");
const net = require("node:net");
const path = require("node:path");
const { spawn, spawnSync } = require("node:child_process");

function createLocalServerRuntime({ app, rootDir, storage, aiConfig, logger }) {
  const nextBuildIdPath = path.join(rootDir, ".next", "BUILD_ID");
  const nextHealthRoutePath = path.join(rootDir, ".next", "server", "app", "api", "health", "route.js");
  const nextCliPath = path.join(rootDir, "node_modules", "next", "dist", "bin", "next");
  const initDbScriptPath = path.join(rootDir, "scripts", "init-db.js");
  const prepareLocalScriptPath = path.join(rootDir, "scripts", "prepare-local.js");
  const storageWorkerPath = path.join(__dirname, "storage-worker.js");
  const defaultServerPort = 3000;
  const sessionCookieName = "card-vault-session";
  const sessionHeaderName = "x-card-vault-session";
  const sessionToken = randomBytes(32).toString("base64url");
  const nextBuildSourcePaths = [
    path.join(rootDir, "app"), path.join(rootDir, "components"), path.join(rootDir, "lib"),
    path.join(rootDir, "next.config.mjs"), path.join(rootDir, "package.json"),
    path.join(rootDir, "prisma", "schema.prisma")
  ];
  let serverPort = defaultServerPort;
  let serverUrl = `http://127.0.0.1:${serverPort}`;
  let serverProcess = null;
  let serverRestartPromise = null;

  function getLatestModifiedTime(targetPath) {
    if (!fs.existsSync(targetPath)) return 0;
    const stats = fs.statSync(targetPath);
    if (!stats.isDirectory()) return stats.mtimeMs;
    return fs.readdirSync(targetPath, { withFileTypes: true }).reduce((latest, entry) => Math.max(latest, getLatestModifiedTime(path.join(targetPath, entry.name))), stats.mtimeMs);
  }

  function isPreparedBuildCurrent() {
    if (!fs.existsSync(nextBuildIdPath) || !fs.existsSync(nextHealthRoutePath)) return false;
    if (app.isPackaged) return true;
    const buildTime = fs.statSync(nextBuildIdPath).mtimeMs;
    const latestSourceTime = nextBuildSourcePaths.reduce((latest, sourcePath) => Math.max(latest, getLatestModifiedTime(sourcePath)), 0);
    return buildTime >= latestSourceTime;
  }

  function getDesktopEnv() {
    return { ...storage.getEnv(), CARD_VAULT_AI_CONFIG_PATH: aiConfig.getConfigPath(), ...aiConfig.getRuntimeEnv() };
  }

  function runNodeCommand(scriptPath, args, logFile) {
    return new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [scriptPath, ...args], { cwd: rootDir, windowsHide: true, env: { ...process.env, ...getDesktopEnv(), ELECTRON_RUN_AS_NODE: "1" } });
      child.stdout.on("data", (chunk) => logger.appendLog(logFile, chunk.toString().trimEnd()));
      child.stderr.on("data", (chunk) => logger.appendLog(logFile, chunk.toString().trimEnd()));
      child.on("error", reject);
      child.on("exit", (code) => code === 0 ? resolve() : reject(new Error(`${path.basename(scriptPath)} ${args.join(" ")} exited with code ${code ?? "unknown"}.`)));
    });
  }

  function checkServer(url) {
    return new Promise((resolve) => {
      const request = http.get(`${url}/api/health`, { headers: { Cookie: `${sessionCookieName}=${sessionToken}`, [sessionHeaderName]: sessionToken } }, (response) => {
        let body = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => { body += chunk; });
        response.on("end", () => { try { const payload = JSON.parse(body); resolve(response.statusCode === 200 && payload.app === "card-vault"); } catch { resolve(false); } });
      });
      request.setTimeout(1500, () => request.destroy());
      request.on("error", () => resolve(false));
    });
  }

  function waitForServer(url, timeoutMs = 30000) {
    return new Promise((resolve, reject) => {
      const startedAt = Date.now();
      const attempt = async () => {
        if (await checkServer(url)) return resolve();
        if (Date.now() - startedAt >= timeoutMs) return reject(new Error(`Timed out waiting for ${url}`));
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
      probe.listen({ host: "127.0.0.1", port }, () => probe.close(() => resolve(true)));
    });
  }

  async function waitForAvailablePort(port, timeoutMs = 5000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (await canListenOnPort(port)) return;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error(`Local service port ${port} is still in use.`);
  }

  async function selectServerTarget() {
    for (let candidate = defaultServerPort; candidate < defaultServerPort + 20; candidate += 1) {
      if (await canListenOnPort(candidate)) { serverPort = candidate; serverUrl = `http://127.0.0.1:${serverPort}`; return; }
    }
    throw new Error("No available local port found for Card Vault.");
  }

  async function ensurePreparedBuild() {
    if (isPreparedBuildCurrent()) { logger.appendLog("desktop.log", "Existing build found."); return; }
    logger.appendLog("desktop.log", "Build missing or stale; preparing local app build.");
    await runNodeCommand(prepareLocalScriptPath, [], "prepare.log");
  }

  async function startServer() {
    logger.appendLog("desktop.log", "Starting local Next server.");
    const dataDir = storage.getDataDir();
    storage.repairDataLayout(dataDir);
    fs.mkdirSync(dataDir, { recursive: true });
    fs.mkdirSync(storage.getUploadsDir(), { recursive: true });
    fs.mkdirSync(storage.getShareCoversDir(), { recursive: true });
    fs.mkdirSync(storage.getShareBackgroundsDir(), { recursive: true });
    await runNodeCommand(initDbScriptPath, [], "prepare.log");
    const dbPath = storage.getDbPath();
    serverProcess = spawn(process.execPath, [nextCliPath, "start", "--hostname", "127.0.0.1", "--port", String(serverPort)], { cwd: rootDir, windowsHide: true, env: { ...process.env, ...getDesktopEnv(), ELECTRON_RUN_AS_NODE: "1", DATABASE_URL: `file:${dbPath.replace(/\\/g, "/")}`, CARD_VAULT_SESSION_TOKEN: sessionToken, CARD_VAULT_ALLOWED_ORIGIN: serverUrl } });
    serverProcess.stdout.on("data", (chunk) => logger.appendLog("server.log", chunk.toString().trimEnd()));
    serverProcess.stderr.on("data", (chunk) => logger.appendLog("server.log", chunk.toString().trimEnd()));
    serverProcess.on("error", (error) => logger.appendLog("desktop.log", `Server process error: ${error.message}`));
    serverProcess.on("exit", (code) => logger.appendLog("desktop.log", `Server exited with code ${code ?? "unknown"}.`));
  }

  function stopServer() {
    const processToStop = serverProcess;
    serverProcess = null;
    if (processToStop && !processToStop.killed && processToStop.exitCode === null) {
      if (process.platform === "win32" && processToStop.pid) {
        const result = spawnSync("taskkill.exe", ["/pid", String(processToStop.pid), "/t", "/f"], { windowsHide: true, stdio: "ignore", timeout: 5000 });
        if (result.error || result.status !== 0) { try { processToStop.kill(); } catch { /* process already exited */ } }
      } else { try { processToStop.kill(); } catch { /* process already exited */ } }
    }
    return processToStop;
  }

  function waitForProcessExit(child, timeoutMs = 5000) {
    if (!child || child.exitCode !== null) return Promise.resolve();
    return new Promise((resolve) => { const timeout = setTimeout(resolve, timeoutMs); child.once("exit", () => { clearTimeout(timeout); resolve(); }); });
  }

  async function resumeLocalServer() { await waitForAvailablePort(serverPort); await startServer(); await waitForServer(serverUrl, 30000); }
  async function restartLocalServer() {
    if (serverRestartPromise) return serverRestartPromise;
    serverRestartPromise = (async () => { logger.appendLog("desktop.log", "Refreshing local service for updated AI settings."); const previousServer = stopServer(); await waitForProcessExit(previousServer); await resumeLocalServer(); logger.appendLog("desktop.log", "Local service refreshed with updated AI settings."); })();
    try { await serverRestartPromise; } finally { serverRestartPromise = null; }
  }

  return { getRootDir: () => rootDir, getServerUrl: () => serverUrl, getServerPort: () => serverPort, getSessionCookie: () => ({ name: sessionCookieName, value: sessionToken }), getDesktopEnv, runNodeCommand, waitForServer, waitForAvailablePort, selectServerTarget, ensurePreparedBuild, startServer, stopServer, waitForProcessExit, resumeLocalServer, restartLocalServer, getStorageWorkerPath: () => storageWorkerPath };
}

module.exports = { createLocalServerRuntime };
