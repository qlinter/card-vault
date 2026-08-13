const fs = require("node:fs");
const http = require("node:http");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");

const unpackedDir = path.resolve(process.argv[2] || "");
const appRoot = path.join(unpackedDir, "resources", "app");
const executablePath = path.join(unpackedDir, "Card Vault.exe");

function availablePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen({ host: "127.0.0.1", port: 0 }, () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      server.close(() => resolve(port));
    });
  });
}

function requestHealth(port) {
  return new Promise((resolve) => {
    const request = http.get(`http://127.0.0.1:${port}/api/health`, (response) => {
      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => { body += chunk; });
      response.on("end", () => {
        try { resolve(response.statusCode === 200 && JSON.parse(body).app === "card-vault"); }
        catch { resolve(false); }
      });
    });
    request.setTimeout(1500, () => request.destroy());
    request.on("error", () => resolve(false));
  });
}

async function main() {
  if (process.platform !== "win32") throw new Error("Packaged runtime smoke test requires Windows.");
  for (const requiredPath of [executablePath, path.join(appRoot, ".next", "BUILD_ID"), path.join(appRoot, "node_modules", "next", "dist", "bin", "next")]) {
    if (!fs.existsSync(requiredPath)) throw new Error(`Packaged runtime is missing ${requiredPath}`);
  }
  const port = await availablePort();
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "card-vault-packaged-smoke-"));
  const child = spawn(executablePath, [path.join(appRoot, "node_modules", "next", "dist", "bin", "next"), "start", "--hostname", "127.0.0.1", "--port", String(port)], {
    cwd: appRoot,
    windowsHide: true,
    env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", CARD_VAULT_DATA_DIR: path.join(tempRoot, "data"), DATABASE_URL: `file:${path.join(tempRoot, "data", "dev.db").replace(/\\/g, "/")}` },
    stdio: ["ignore", "pipe", "pipe"]
  });
  let output = "";
  child.stdout.on("data", (chunk) => { output += chunk.toString(); });
  child.stderr.on("data", (chunk) => { output += chunk.toString(); });
  try {
    const deadline = Date.now() + 45000;
    while (Date.now() < deadline) {
      if (await requestHealth(port)) {
        process.stdout.write("Packaged Next runtime health smoke test passed.\n");
        return;
      }
      if (child.exitCode !== null) throw new Error(`Packaged server exited with ${child.exitCode}: ${output.slice(-2000)}`);
      await new Promise((resolve) => setTimeout(resolve, 400));
    }
    throw new Error(`Timed out waiting for packaged runtime health endpoint: ${output.slice(-2000)}`);
  } finally {
    if (child.exitCode === null) child.kill();
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

main().catch((error) => { process.stderr.write(`${error instanceof Error ? error.message : error}\n`); process.exitCode = 1; });
