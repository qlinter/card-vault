const fs = require("node:fs"), os = require("node:os"), path = require("node:path");
const assert = require("node:assert/strict");
const { DatabaseSync } = require("node:sqlite");
const { fetchTestServer: fetch, fileDatabaseUrl, findAvailablePort, initializeTestDatabase, removeTempRoot, startTestServer, stopServer, waitForServer } = require("./test-http-flow-utils");
async function main() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "vault-scout-benchmark-")), dataDir = path.join(root, "data"), dbPath = path.join(dataDir, "dev.db");
  const env = { ...process.env, CARD_VAULT_DATA_DIR: dataDir, DATABASE_URL: fileDatabaseUrl(dbPath), NODE_ENV: "production" };
  const port = await findAvailablePort(3390), base = "http://127.0.0.1:" + port, output = [];
  let server, db;
  async function measure(route) {
    const samples = []; let bytes = 0, result;
    for (let sample = 0; sample < 3; sample++) {
      const start = performance.now(), response = await fetch(base + route, { headers: { Connection: "close" }, signal: AbortSignal.timeout(60000) });
      assert.equal(response.status, 200);
      const raw = await response.text(); samples.push(Math.round(performance.now() - start)); bytes = Buffer.byteLength(raw); result = JSON.parse(raw);
    }
    assert.ok(result.plans.length <= 20);
    return { medianMs: samples.sort((a, b) => a-b)[1], bytes, rows: result.plans.length, count: result.count };
  }
  try {
    initializeTestDatabase(env);
    db = new DatabaseSync(dbPath);
    const wish = db.prepare("INSERT INTO CollectionPlan(id,title,playerName,notes) VALUES(?,?,?,?)");
    let seeded = 0;
    server = startTestServer(port, env, output); await waitForServer(base, output, server, "Scout benchmark");
    for (const size of [1000, 5000]) {
      db.exec("BEGIN");
      for (; seeded < size; seeded++) wish.run("bench-" + String(seeded).padStart(6,"0"), "Wish " + seeded, "Player " + seeded, "Synthetic notes ".repeat(20));
      db.exec("COMMIT");
      console.log(JSON.stringify({ size, firstPage: await measure("/api/scout"), laterPage: await measure("/api/scout?page=20"), search: await measure("/api/scout?q=Player%2050") }));
    }
  } finally { db?.close(); stopServer(server); await removeTempRoot(root); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
