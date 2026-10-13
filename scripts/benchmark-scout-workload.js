const fs = require("node:fs"), os = require("node:os"), path = require("node:path");
const assert = require("node:assert/strict");
const { DatabaseSync } = require("node:sqlite");
const { fetchTestServer: fetch, fileDatabaseUrl, findAvailablePort, initializeTestDatabase, removeTempRoot, startTestServer, stopServer, waitForServer } = require("./test-http-flow-utils");

async function main() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "vault-scout-benchmark-")), dataDir = path.join(root, "data"), dbPath = path.join(dataDir, "dev.db");
  const env = { ...process.env, CARD_VAULT_DATA_DIR: dataDir, DATABASE_URL: fileDatabaseUrl(dbPath), NODE_ENV: "production" };
  const port = await findAvailablePort(3390), base = `http://127.0.0.1:${port}`, output = [];
  let server, db;
  async function measure(route) {
    const samples = [];
    let bytes = 0, result;
    for (let sample = 0; sample < 3; sample++) {
      const start = performance.now();
      const response = await fetch(base + route, { headers: { Connection: "close" }, signal: AbortSignal.timeout(60000) });
      assert.equal(response.status, 200);
      const raw = await response.text();
      samples.push(Math.round(performance.now() - start));
      bytes = Buffer.byteLength(raw); result = JSON.parse(raw);
    }
    if (result.plans) assert.ok(result.plans.every(row => Array.isArray(row.acquiredCardIds) && !Object.hasOwn(row, 'acquiredCards')));
    return { medianMs: samples.sort((a, b) => a - b)[1], bytes, rows: result.tasks?.length ?? result.watches?.length ?? result.cards?.length };
  }
  try {
    initializeTestDatabase(env);
    db = new DatabaseSync(dbPath); db.exec("PRAGMA foreign_keys=ON");
    const card = db.prepare("INSERT INTO Card(id,playerName,cardTitle,sport) VALUES(?,'Benchmark',?,'Basketball')");
    const quote = db.prepare("INSERT INTO CardValuation(id,cardId,amountMinor,valuedAt,provenance) VALUES(?,?,1000,?,'benchmark')");
    const watch = db.prepare("INSERT INTO ScoutWatch(id,title,queryJson) VALUES(?,?,?)");
    const wish = db.prepare("INSERT INTO CollectionPlan(id,title,notes) VALUES(?,?,?)");
    const link = db.prepare("INSERT INTO ScoutWishWatch(planId,watchId) VALUES(?,?)");
    const cardLink = db.prepare("INSERT INTO ScoutWishCard(planId,cardId) VALUES(?,?)");
    const details = db.prepare("INSERT INTO ScoutWishDetails(planId,priority,targetCount) VALUES(?,2,?)");
    let seeded = 0;
    server = startTestServer(port, env, output); await waitForServer(base, output, server, "Scout benchmark");
    for (const size of [1000, 5000]) {
      const previousSize = seeded;
      db.exec("BEGIN");
      for (; seeded < size; seeded++) {
        const id = `bench-${String(seeded).padStart(6, "0")}`, keyword = `Player ${seeded} 2025 Gold #${seeded}`;
        card.run(id, `Card ${seeded}`); watch.run(id, keyword, JSON.stringify({ keyword }));
        wish.run(id, `Wish ${seeded}`, "Synthetic notes ".repeat(20)); link.run(id, id);
        for (let month = 0; month < 12; month++) quote.run(`${id}-${month}`, id, Date.UTC(2025, month, 1));
      }
      for (let wishIndex = previousSize; wishIndex < size; wishIndex++) {
        const wishId = `bench-${String(wishIndex).padStart(6, "0")}`, count = wishIndex % 50 === 0 ? 500 : 20;
        details.run(wishId, count);
        for (let offset = 0; offset < count; offset++) cardLink.run(wishId, `bench-${String((wishIndex + offset) % size).padStart(6, "0")}`);
      }
      db.exec("COMMIT");
      console.log(JSON.stringify({ size, bindings: db.prepare('SELECT COUNT(*) n FROM ScoutWishCard').get().n, overview: await measure("/api/home-overview"), queue: await measure("/api/home-overview?tasks=1"), scout: await measure("/api/scout"), pagedScout: await measure("/api/scout?window=1"), largestBinding: await measure("/api/scout?wishCards=bench-000000") }));
    }
  } finally { db?.close(); stopServer(server); await removeTempRoot(root); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
