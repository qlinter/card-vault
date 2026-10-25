const assert = require("node:assert/strict"), fs = require("node:fs"), os = require("node:os"), path = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const { fetchTestServer: fetch, fileDatabaseUrl, findAvailablePort, initializeTestDatabase, removeTempRoot, startTestServer, stopServer, waitForServer } = require("./test-http-flow-utils");

async function main() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "card-vault-data-workspace-"));
  const data = path.join(root, "data"), database = path.join(data, "dev.db"), output = [];
  const env = { ...process.env, CARD_VAULT_DATA_DIR: data, DATABASE_URL: fileDatabaseUrl(database), NODE_ENV: "production" };
  const port = await findAvailablePort(3380), base = `http://127.0.0.1:${port}`;
  let db, server;
  const results = [];
  try {
    initializeTestDatabase(env);
    db = new DatabaseSync(database);
    db.exec("PRAGMA foreign_keys=ON; PRAGMA busy_timeout=30000");
    const card = db.prepare("INSERT INTO Card(id,playerName,cardTitle,sport,holdingQuantity) VALUES(?,'Benchmark',?,'Basketball',1)");
    const buy = db.prepare("INSERT INTO CardTransaction(id,cardId,kind,amountMinor,currency,quantity,occurredAt,provenance) VALUES(?,?,'purchase',10000,'CNY',1,?,'benchmark')");
    const quote = db.prepare("INSERT INTO CardValuation(id,cardId,amountMinor,currency,valuedAt,source,provenance) VALUES(?,?,12000,'CNY',?,'个人估计','benchmark')");
    server = startTestServer(port, env, output);
    await waitForServer(base, output, server, "Data workspace benchmark");
    let count = 0;
    for (const size of [1000, 5000, 10000]) {
      db.exec("BEGIN");
      while (count < size) {
        const id = `benchmark-${String(count++).padStart(5, "0")}`;
        card.run(id, id); buy.run(`${id}-buy`, id, new Date("2025-01-01T00:00:00Z").getTime()); quote.run(`${id}-quote`, id, new Date("2026-01-01T00:00:00Z").getTime());
      }
      db.exec("COMMIT");
      for (const route of ["/portfolio", "/portfolio?tab=details", "/portfolio?tab=details&page=2", "/portfolio?tab=trends"]) {
        const timings = [];
        let firstRequestMs = 0;
        for (let round = 0; round < 6; round++) {
          const start = performance.now();
          const response = await fetch(base + route, { signal: AbortSignal.timeout(120000) });
          const text = await response.text();
          assert.equal(response.status, 200, text.slice(0, 200));
          assert.ok(!text.includes('data-next-error-message='), "server rendering failed");
          const elapsed = Math.round(performance.now() - start);
          if (round) timings.push(elapsed); else firstRequestMs = elapsed;
        }
        const sorted = [...timings].sort((a, b) => a - b);
        const result = { cards: size, route, firstRequestMs, timingsMs: timings, p50Ms: sorted[2], p95Ms: sorted[4] };
        results.push(result); console.log(JSON.stringify(result));
      }
    }
    fs.mkdirSync("logs", { recursive: true });
    fs.writeFileSync("logs/data-workspace-benchmark.json", JSON.stringify({ node: process.version, scope: "Isolated production HTTP responses, including SQLite and server rendering; 1 purchase and 1 valuation per card, excludes browser rendering; first request discarded, 5 samples per route", results }, null, 2));
  } finally { db?.close(); await stopServer(server); await removeTempRoot(root); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
