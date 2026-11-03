const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const net = require("node:net");
const http = require("node:http");
const { createLocalServerRuntime } = require("../electron/local-server-runtime");
const { removeTempRoot } = require("./test-http-flow-utils");

async function main() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "card-vault-desktop-start-"));
  const data = path.join(root, "data");
  const output = [];
  // Keep the child isolated from machine proxy settings; all AI traffic stays on loopback.
  const proxyEnvironment = Object.fromEntries(["HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "NO_PROXY", "http_proxy", "https_proxy", "all_proxy", "no_proxy"].map(name => [name, process.env[name]]));
  for (const name of Object.keys(proxyEnvironment)) delete process.env[name];
  const sockets = new Set();
  const requests = [], resolvedTargets = [];
  let slowStarted, slowClosed;
  const started = new Promise(resolve => { slowStarted = resolve; });
  const closed = new Promise(resolve => { slowClosed = resolve; });
  const trackSockets = server => server.on("connection", socket => {
    sockets.add(socket);
    socket.on("error", () => {});
    socket.on("close", () => sockets.delete(socket));
  });
  const listen = server => new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve(server.address().port));
  });
  const upstream = trackSockets(http.createServer((request, response) => {
    requests.push({ path: request.url, auth: request.headers.authorization, proxyAuth: request.headers["proxy-authorization"] });
    request.resume();
    if (request.url === "/slow/v1/chat/completions") {
      slowStarted(); response.on("close", slowClosed); return;
    }
    response.setHeader("Content-Type", "application/json");
    response.end(JSON.stringify(request.url === "/v1/models" ? { data: [{ id: "fixture-model" }] } : { choices: [{ message: { content: "OK" } }] }));
  }));
  const proxy = trackSockets(http.createServer());
  let proxyPort;
  const runtime = createLocalServerRuntime({
    app: { isPackaged: false }, rootDir: path.resolve(__dirname, ".."),
    storage: {
      getEnv: () => ({ CARD_VAULT_DATA_DIR: data, DATABASE_URL: `file:${path.join(data, "dev.db").replaceAll("\\", "/")}` }), getDataDir: () => data,
      getDbPath: () => path.join(data, "dev.db"), ensureDataLayout: () => {},
      getUploadsDir: () => path.join(data, "uploads"),
      getShareCoversDir: () => path.join(data, "share-covers"),
      getShareBackgroundsDir: () => path.join(data, "share-backgrounds")
    },
    aiConfig: { getConfigPath: () => path.join(root, "ai.json"), getRuntimeEnv: () => ({}) },
    logger: { appendLog: (file, text) => output.push(`${file}: ${text}`) },
    resolveSystemProxy: async target => { resolvedTargets.push(target); return `PROXY 127.0.0.1:${proxyPort}`; }
  });
  const occupied = net.createServer();
  try {
    const upstreamPort = await listen(upstream);
    proxy.on("connect", (request, client, head) => {
      if (request.url !== "model.invalid:80") { client.destroy(); return; }
      const target = net.connect(upstreamPort, "127.0.0.1", () => {
        client.write("HTTP/1.1 200 Connection Established\r\n\r\n");
        if (head.length) target.write(head);
        client.pipe(target).pipe(client);
      });
      client.on("close", () => target.destroy());
      target.on("error", () => client.destroy());
    });
    proxyPort = await listen(proxy);
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
    const draft = { provider: "openai", openai: { endpoint: "http://model.invalid/v1/chat/completions", apiKey: "fixture-key", model: "fixture-model" }, proxy: { mode: "auto", noProxy: "" } };
    const post = route => fetch(url + route, { method: "POST", headers: { Cookie: `${cookie.name}=${cookie.value}`, Origin: url, "Content-Type": "application/json" }, body: JSON.stringify(draft), signal: AbortSignal.timeout(10000) });
    const models = await post("/api/ai/models");
    assert.equal(models.status, 200);
    assert.deepEqual(await models.json(), { models: ["fixture-model"] });
    const connection = await post("/api/ai/test-settings");
    assert.equal(connection.status, 200);
    assert.deepEqual(await connection.json(), { ok: true, capability: "text", route: { source: "system", connection: "proxy", protocol: "http", attempt: 1 } });
    assert.deepEqual(resolvedTargets, ["http://model.invalid/v1/models", "http://model.invalid/v1/chat/completions"]);
    assert.deepEqual(requests.map(request => request.path), ["/v1/models", "/v1/chat/completions"]);
    assert.ok(requests.every(request => request.auth === "Bearer fixture-key" && request.proxyAuth === undefined));
    const abort = new AbortController();
    const slow = fetch(url + "/api/ai/test-settings", { method: "POST", headers: { Cookie: `${cookie.name}=${cookie.value}`, Origin: url, "Content-Type": "application/json" }, body: JSON.stringify({ ...draft, openai: { ...draft.openai, endpoint: "http://model.invalid/slow/v1/chat/completions" } }), signal: abort.signal });
    await started;
    abort.abort();
    await assert.rejects(slow, { name: "AbortError" });
    let cancellationTimeout;
    try { await Promise.race([closed, new Promise((_, reject) => { cancellationTimeout = setTimeout(() => reject(new Error("Client cancellation did not close the upstream request")), 5000); })]); }
    finally { clearTimeout(cancellationTimeout); }
    await runtime.restartLocalServer();
    assert.equal(runtime.getServerUrl(), url);
    console.log(`Desktop startup passed: reserved-range fallback, bind-race recovery, authenticated health, system proxy IPC for model/chat routes and same-origin restart (${url}).`);
  } catch (error) {
    console.error(output.join("\n"));
    throw error;
  } finally {
    await runtime.waitForProcessExit(runtime.stopServer());
    occupied.closeAllConnections?.();
    occupied.close();
    for (const socket of sockets) socket.destroy();
    await Promise.all([upstream, proxy].map(server => new Promise(resolve => server.close(resolve))));
    for (const [name, value] of Object.entries(proxyEnvironment)) { if (value === undefined) delete process.env[name]; else process.env[name] = value; }
    await removeTempRoot(root);
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
