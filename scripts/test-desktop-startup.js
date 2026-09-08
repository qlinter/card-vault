const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const net = require("node:net");
const { createLocalServerRuntime } = require("../electron/local-server-runtime");
const { removeTempRoot } = require("./test-http-flow-utils");

async function main() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "card-vault-desktop-start-"));
  const data = path.join(root, "data");
  const output = [];
  const runtime = createLocalServerRuntime({
    app: { isPackaged: false }, rootDir: path.resolve(__dirname, ".."),
    storage: {
      getEnv: () => ({ CARD_VAULT_DATA_DIR: data, DATABASE_URL: `file:${path.join(data, "dev.db").replaceAll("\\", "/")}` }), getDataDir: () => data,
      getDbPath: () => path.join(data, "dev.db"), repairDataLayout: () => {},
      getUploadsDir: () => path.join(data, "uploads"),
      getShareCoversDir: () => path.join(data, "share-covers"),
      getShareBackgroundsDir: () => path.join(data, "share-backgrounds")
    },
    aiConfig: { getConfigPath: () => path.join(root, "ai.json"), getRuntimeEnv: () => ({}) },
    logger: { appendLog: (file, text) => output.push(`${file}: ${text}`) }
  });
  const occupied = net.createServer();
  try {
    await runtime.selectServerTarget();
    const selected = runtime.getServerPort();
    // Simulate another application claiming the port between probe and spawn.
    await new Promise((resolve, reject) => { occupied.once("error", reject); occupied.listen({ host: "127.0.0.1", port: selected }, resolve); });
    await runtime.startServer();
    assert.notEqual(runtime.getServerPort(), selected);
    assert.ok(output.some(line => line.includes("requesting another local port")));
    const url = runtime.getServerUrl();
    assert.equal((await fetch(url + "/api/health")).status, 403);
    const cookie = runtime.getSessionCookie();
    const response = await fetch(url + "/api/health", { headers: { Cookie: `${cookie.name}=${cookie.value}` } });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).app, "card-vault");
    await runtime.restartLocalServer();
    assert.equal(runtime.getServerUrl(), url);
    console.log(`Desktop startup passed: reserved-range fallback, bind-race recovery, authenticated health and same-origin restart (${url}).`);
  } catch (error) {
    console.error(output.join("\n"));
    throw error;
  } finally {
    await runtime.waitForProcessExit(runtime.stopServer());
    occupied.closeAllConnections?.();
    occupied.close();
    await removeTempRoot(root);
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
