const fs = require("node:fs");
const net = require("node:net");
const path = require("node:path");
const { execFileSync, spawn } = require("node:child_process");

const rootDir = path.resolve(__dirname, "..");
const initDbScriptPath = path.join(rootDir, "scripts", "init-db.js");
const nextCliPath = path.join(rootDir, "node_modules", "next", "dist", "bin", "next");

function fileDatabaseUrl(filePath) {
  return `file:${filePath.replace(/\\/g, "/")}`;
}

function findAvailablePort(startPort) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(findAvailablePort(startPort + 1)));
    server.listen({ host: "127.0.0.1", port: startPort }, () => server.close(() => resolve(startPort)));
  });
}

function initializeTestDatabase(env) {
  execFileSync(process.execPath, [initDbScriptPath], { cwd: rootDir, env, stdio: "pipe" });
}

function startTestServer(port, env, output) {
  const serverProcess = spawn(
    process.execPath,
    [nextCliPath, "start", "--hostname", "127.0.0.1", "--port", String(port)],
    { cwd: rootDir, env, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] }
  );
  serverProcess.stdout.on("data", (chunk) => output.push(chunk.toString()));
  serverProcess.stderr.on("data", (chunk) => output.push(chunk.toString()));
  return serverProcess;
}

async function waitForServer(baseUrl, output, serverProcess, label) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (serverProcess.exitCode !== null) {
      throw new Error(`${label} server exited with code ${serverProcess.exitCode}.\n${output.join("")}`);
    }
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok) return;
    } catch {
      // The server may still be starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for the ${label.toLowerCase()} server.\n${output.join("")}`);
}

async function fetchPage(baseUrl, route) {
  const response = await fetch(`${baseUrl}${route}`);
  const html = await response.text();
  if (!response.ok) {
    throw new Error(`${route} returned HTTP ${response.status}.\n${html.slice(0, 500)}`);
  }
  return html;
}

function decodeHtmlAttribute(value = "") {
  return value.replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, "&");
}

function stopServer(serverProcess) {
  if (!serverProcess || serverProcess.killed) return;
  try {
    serverProcess.kill();
  } catch {
    // The server may already have exited.
  }
  try {
    if (process.platform === "win32") {
      execFileSync("taskkill.exe", ["/pid", String(serverProcess.pid), "/t", "/f"], {
        stdio: "ignore",
        timeout: 3000
      });
    }
  } catch {
    // The child process tree may already have exited.
  }
}

async function removeTempRoot(tempRoot) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    try {
      fs.rmSync(tempRoot, { recursive: true, force: true });
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }
  console.warn(`Unable to remove temporary E2E directory: ${tempRoot}`);
}

module.exports = {
  decodeHtmlAttribute,
  fetchPage,
  fileDatabaseUrl,
  findAvailablePort,
  initializeTestDatabase,
  removeTempRoot,
  startTestServer,
  stopServer,
  waitForServer
};
