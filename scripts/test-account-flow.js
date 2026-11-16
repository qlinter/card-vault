const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const http = require("node:http");
const { spawn } = require("node:child_process");
const { DatabaseSync } = require("node:sqlite");
const { findAvailablePort, fileDatabaseUrl, initializeTestDatabase, stopServer, removeTempRoot } = require("./test-http-flow-utils");
const appRoot = process.env.CARD_VAULT_TEST_APP_ROOT ? path.resolve(process.env.CARD_VAULT_TEST_APP_ROOT) : path.resolve(__dirname, "..");

async function main() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "card-vault-account-http-"));
  const data = path.join(root, "data"), accountPath = path.join(root, "config", "account.json");
  const dbPath = path.join(data, "dev.db"), origin = `http://127.0.0.1:${await findAvailablePort(3460)}`;
  const env = { ...process.env, CARD_VAULT_DATA_DIR: data, DATABASE_URL: fileDatabaseUrl(dbPath), CARD_VAULT_ACCOUNT_PATH: accountPath };
  delete env.CARD_VAULT_ACCOUNT_RUN_ID; delete env.CARD_VAULT_SESSION_TOKEN; delete env.CARD_VAULT_ALLOWED_ORIGIN;
  initializeTestDatabase(env);
  const db = new DatabaseSync(dbPath);
  db.prepare("INSERT INTO Card(id,playerName,cardTitle,sport,visibility) VALUES('account-http','Protected HTTP fixture','Private archive','Basketball','private')").run(); db.close();
  for (const folder of ["uploads", "thumbnails", "share-covers", "share-backgrounds"]) {
    fs.mkdirSync(path.join(data, folder), { recursive: true });
    fs.copyFileSync(path.resolve(__dirname, "../tests/fixtures/ui-media/showcase-bg.webp"), path.join(data, folder, "auth.webp"));
  }
  let server;
  const output = [];
  let cookie = "";
  const request = (route, options = {}) => fetch(origin + route, { redirect: "manual", ...options, headers: { Cookie: cookie, ...options.headers } });
  const post = async (action, values = {}) => {
    const response = await request("/api/account", { method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify({ action, ...values }) });
    const setCookie = response.headers.getSetCookie().find(value => value.startsWith("card-vault-account="));
    if (setCookie) cookie = setCookie.split(";")[0];
    return { response, payload: await response.json() };
  };
  async function start() {
    server = spawn(process.execPath, [path.join(appRoot, "node_modules/next/dist/bin/next"), "start", "--hostname", "127.0.0.1", "--port", new URL(origin).port], { cwd: appRoot, env, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    server.stdout.on("data", chunk => output.push(String(chunk))); server.stderr.on("data", chunk => output.push(String(chunk)));
    const deadline = performance.now() + 30000;
    while (performance.now() < deadline) {
      if (server.exitCode !== null) throw new Error(output.join(""));
      try { if ((await request("/api/health")).status === 200) return; } catch { /* Starting. */ }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error("Account HTTP server did not start.");
  }
  async function stop() {
    const exited = server.exitCode === null ? new Promise(resolve => server.once("exit", resolve)) : Promise.resolve();
    stopServer(server); await exited;
  }
  const privateRoutes = ["/", "/cards/new", "/settings", "/showcase", "/portfolio", "/shares", "/api/cards", "/api/ai/settings", "/api/card-entry/drafts", "/api/data-center", "/api/scout", "/api/immersive", "/api/collection-recaps", "/api/collection-recaps/export", "/api/cards/account-http/images/export", "/media/auth.webp", "/thumbnails/auth.webp", "/share-covers/auth.webp", "/share-backgrounds/auth.webp"];
  try {
    await start();
    for (const route of privateRoutes) {
      const response = await request(route);
      assert.equal(response.status, 401, route);
      assert.match(response.headers.get("cache-control"), /no-store/, route);
      assert.ok(!(await response.text()).includes("Protected HTTP fixture"));
    }
    const document = await request("/", { headers: { "Sec-Fetch-Dest": "document" } });
    assert.equal(document.status, 303); assert.ok(document.headers.get("location").endsWith("/login"));
    const csrf = await request("/api/account", { method: "POST", headers: { "Content-Type": "application/json", Origin: "https://attacker.example" }, body: JSON.stringify({ action: "setup" }) });
    assert.equal(csrf.status, 403);
    const rebinding = await new Promise((resolve, reject) => {
      const req = http.get(origin + "/login", { headers: { Host: "attacker.example" } }, response => { response.resume(); response.on("end", () => resolve(response.statusCode)); });
      req.on("error", reject);
    });
    assert.equal(rebinding, 403);
    const initial = await post("setup", { username: "HTTP Collector", password: "HTTP local passphrase 123" });
    assert.equal(initial.response.status, 200); assert.ok(initial.payload.recoveryCode);
    assert.match(initial.response.headers.get("set-cookie"), /HttpOnly/i);
    assert.match(initial.response.headers.get("clear-site-data"), /cache/);
    assert.equal((await request("/api/cards")).status, 401);
    assert.equal((await post("confirm-recovery", { acknowledged: true })).response.status, 200);
    const validCookie = cookie;
    for (const route of ["/", "/api/cards", "/media/auth.webp", "/share-covers/auth.webp", "/share-backgrounds/auth.webp"]) {
      const response = await request(route); assert.equal(response.status, 200, route);
      assert.match(response.headers.get("cache-control"), /no-store/, route);
    }
    const raw = fs.readFileSync(accountPath, "utf8");
    assert.equal(raw.includes("HTTP local passphrase 123"), false);
    await post("logout"); cookie = validCookie;
    assert.equal((await request("/media/auth.webp")).status, 401);
    const login = await post("login", { username: "HTTP Collector", password: "HTTP local passphrase 123" }); assert.equal(login.response.status, 200);
    const beforeRestart = cookie;
    await stop(); await start(); cookie = beforeRestart;
    assert.equal((await request("/api/cards")).status, 401, "Standalone server restart must reject the previous process session.");
    assert.equal((await post("login", { username: "HTTP Collector", password: "HTTP local passphrase 123" })).response.status, 200);
    fs.writeFileSync(accountPath, "{");
    assert.equal((await request("/api/cards")).status, 401);
    const broken = await request("/api/account"); assert.equal(broken.status, 503);
    assert.equal((await broken.json()).state, "unavailable");
    assert.equal((await post("setup", { username: "Other", password: "a different passphrase" })).response.status, 503);
    console.log(`Account HTTP security passed: ${privateRoutes.length} anonymous routes, real media cache headers, CSRF/Host, recovery acknowledgement, logout replay, standalone restart and corrupt-account fail-closed.`);
  } finally { if (server) await stop(); await removeTempRoot(root); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
