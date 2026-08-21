const fs = require("node:fs");
const http = require("node:http");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");
const { execFileSync, spawn } = require("node:child_process");

const rootDir = path.resolve(__dirname, "..");
const nextCliPath = path.join(rootDir, "node_modules", "next", "dist", "bin", "next");
const initDbScriptPath = path.join(rootDir, "scripts", "init-db.js");

function findAvailablePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.once("error", reject);
    server.listen({ host: "127.0.0.1", port: 0 }, () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      server.close(() => resolve(port));
    });
  });
}

function request(port, route, { method = "GET", headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: "127.0.0.1", port, path: route, method, headers }, (response) => {
      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => { body += chunk; });
      response.on("end", () => resolve({ status: response.statusCode, headers: response.headers, body }));
    });
    req.setTimeout(2000, () => req.destroy(new Error("request timed out")));
    req.on("error", reject);
    req.end();
  });
}

async function waitForServer(port, token, child, output) {
  const deadline = Date.now() + 30000;
  let lastHealth = "no response";
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Security test server exited with ${child.exitCode}: ${output.join("").slice(-2000)}`);
    try {
      const health = await request(port, "/api/health", { headers: { Cookie: `card-vault-session=${token}`, "x-card-vault-session": token } });
      lastHealth = `${health.status} ${health.body.slice(0, 200)}`;
      if (health.status === 200) return;
    } catch (error) {
      lastHealth = error instanceof Error ? error.message : String(error);
      // The production server may still be starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Timed out waiting for the security test server (${lastHealth}): ${output.join("").slice(-2000)}`);
}

async function main() {
  const port = await findAvailablePort();
  const origin = `http://127.0.0.1:${port}`;
  const token = "card-vault-security-e2e-token";
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "card-vault-security-e2e-"));
  const dataDir = path.join(tempRoot, "data");
  const dbPath = path.join(dataDir, "dev.db");
  const env = {
    ...process.env,
    CARD_VAULT_DATA_DIR: dataDir,
    DATABASE_URL: `file:${dbPath.replace(/\\/g, "/")}`,
    CARD_VAULT_SESSION_TOKEN: token,
    CARD_VAULT_ALLOWED_ORIGIN: origin
  };
  fs.mkdirSync(dataDir, { recursive: true });
  execFileSync(process.execPath, [initDbScriptPath], { cwd: rootDir, env, stdio: "ignore" });
  const child = spawn(process.execPath, [nextCliPath, "start", "--hostname", "127.0.0.1", "--port", String(port)], {
    cwd: rootDir,
    env,
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"]
  });
  const output = [];
  child.stdout.on("data", (chunk) => output.push(chunk.toString()));
  child.stderr.on("data", (chunk) => output.push(chunk.toString()));

  try {
    await waitForServer(port, token, child, output);
    const unauthenticated = await request(port, "/");
    if (unauthenticated.status !== 403) throw new Error(`Unauthenticated local request returned ${unauthenticated.status}.`);

    const cookie = `card-vault-session=${token}`;
    const authenticated = await request(port, "/", { headers: { Cookie: cookie } });
    if (authenticated.status !== 200 || !String(authenticated.headers["content-security-policy"] || "").includes("frame-ancestors 'none'")) {
      throw new Error(`Authenticated local request failed (${authenticated.status}) or omitted CSP.`);
    }

    const crossOriginMutation = await request(port, "/api/health", {
      method: "POST",
      headers: { Cookie: cookie, Origin: "https://attacker.example" }
    });
    if (crossOriginMutation.status !== 403) throw new Error(`Cross-origin mutation returned ${crossOriginMutation.status}.`);

    const sameOriginMutation = await request(port, "/api/health", {
      method: "POST",
      headers: { Cookie: cookie, Origin: origin }
    });
    if (sameOriginMutation.status === 403) throw new Error("Same-origin mutation was rejected by the local-session layer.");

    const forgedHost = await request(port, "/", { headers: { Cookie: cookie, Host: `localhost:${port}` } });
    if (forgedHost.status !== 403) throw new Error(`Forged Host request returned ${forgedHost.status}.`);

    process.stdout.write("Local session security E2E passed: token, CSP, Host, and Origin enforcement.\n");
  } finally {
    if (child.exitCode === null) {
      await new Promise((resolve) => {
        child.once("exit", resolve);
        child.kill();
      });
    }
    fs.rmSync(tempRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : error}\n`);
  process.exitCode = 1;
});
