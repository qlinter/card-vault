const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const sharp = require("sharp");
const { DatabaseSync } = require("node:sqlite");
const { fileDatabaseUrl, findAvailablePort, initializeTestDatabase, removeTempRoot, startTestServer, stopServer, waitForServer } = require("./test-http-flow-utils");

async function main() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "card-vault-dense-"));
  const data = path.join(root, "data"), dbPath = path.join(data, "dev.db");
  const metricPath = path.join(root, "memory.json"), sampler = path.join(root, "memory.cjs");
  fs.writeFileSync(sampler, `const fs=require('node:fs');let peak=0;setInterval(()=>{const rss=process.memoryUsage().rss;peak=Math.max(peak,rss);fs.writeFileSync(${JSON.stringify(metricPath)},JSON.stringify({rss,peak}));},250).unref();`);
  const env = { ...process.env, CARD_VAULT_DATA_DIR: data, DATABASE_URL: fileDatabaseUrl(dbPath), NODE_ENV: "production" };
  const port = await findAvailablePort(3370), base = `http://127.0.0.1:${port}`, output = [];
  let db, server;
  const results = [];
  try {
    initializeTestDatabase(env);
    db = new DatabaseSync(dbPath);
    db.exec("PRAGMA foreign_keys=ON; PRAGMA busy_timeout=30000");
    db.exec("INSERT INTO ExchangeRate(id,effectiveDate,rateMicros,source,revision) VALUES('fx','2020-01-01',7000000,'synthetic',1)");
    const uploads = path.join(data, "uploads"); fs.mkdirSync(uploads, { recursive: true });
    const picture = await sharp(Buffer.from('<svg width="1600" height="2400"><defs><linearGradient id="g"><stop stop-color="#235275"/><stop offset="1" stop-color="#d6b376"/></linearGradient></defs><rect width="1600" height="2400" fill="url(#g)"/><circle cx="800" cy="1000" r="650" fill="#ffffff" opacity=".25"/><rect x="200" y="1900" width="1200" height="220" fill="#273744"/></svg>')).webp({ quality: 85 }).toBuffer();
    const template = path.join(root, "image.webp"); fs.writeFileSync(template, picture);
    server = startTestServer(port, { ...env, NODE_OPTIONS: `${process.env.NODE_OPTIONS || ""} --require "${sampler.replaceAll("\\", "/")}"`.trim() }, output);
    await waitForServer(base, output, server, "Dense benchmark");
    const card = db.prepare("INSERT INTO Card(id,playerName,cardTitle,sport,holdingQuantity) VALUES(?,'Dense benchmark',?,'Basketball',1)");
    const transaction = db.prepare("INSERT INTO CardTransaction(id,cardId,kind,amountMinor,currency,quantity,occurredAt,provenance) VALUES(?,?,?,?,'CNY',?,?,'benchmark')");
    const quote = db.prepare("INSERT INTO CardValuation(id,cardId,amountMinor,currency,valuedAt,source,provenance) VALUES(?,?,?,'CNY',?,'个人估计','benchmark')");
    const expense = db.prepare("INSERT INTO CardExpense(id,cardId,kind,context,amountMinor,currency,occurredAt,provenance) VALUES(?,?,'grading','grading',100,'USD',?,'benchmark')");
    const image = db.prepare("INSERT INTO CardImage(id,cardId,path) VALUES(?,?,?)");
    const today = new Date();
    const month = offset => new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + offset, 1)).toISOString();
    const timed = async route => {
      const start = performance.now();
      // Synchronous fixture seeding can outlive server keep-alive while blocking
      // this client's socket-close callbacks. Do not reuse those idle sockets.
      const response = await fetch(base + route, { headers: { Connection: "close" }, signal: AbortSignal.timeout(120000) });
      assert.equal(response.status, 200, route);
      const text = await response.text();
      return { ms: Math.round(performance.now() - start), text };
    };
    let seeded = 0;
    for (const size of [1000, 5000, 10000]) {
      db.exec("BEGIN");
      for (; seeded < size; seeded++) {
        const id = `dense-${String(seeded).padStart(5, "0")}`;
        card.run(id, `Card ${seeded}`);
        transaction.run(`${id}-buy`, id, "purchase", 20000 + seeded * 2, 2, month(-30));
        transaction.run(`${id}-sale`, id, "sale", 15000 + seeded, 1, month(-3));
        for (let i = 0; i < 24; i++) {
          quote.run(`${id}-q${i}`, id, 15000 + seeded + i * 10, month(i - 23));
          if (i % 2 === 0) expense.run(`${id}-e${i}`, id, month(i - 23));
        }
        for (const side of ["front", "back"]) {
          const name = `${id}-${side}.webp`;
          fs.copyFileSync(template, path.join(uploads, name));
          image.run(`${id}-${side}`, id, `/media/${name}`);
        }
      }
      db.exec("COMMIT");
      // Each size measures a full financial-index rebuild, not just newly seeded cards.
      db.exec("INSERT OR IGNORE INTO CardReportDirty SELECT id FROM Card; UPDATE DataRevision SET projectionRevision=-1 WHERE id=1");
      const first = await timed("/api/cards?sort=valueCnyDesc");
      const page = JSON.parse(first.text);
      assert.equal(page.totalCount, size);
      assert.equal(db.prepare("SELECT COUNT(*) n FROM CardReportDirty").get().n, 0);
      const warm = await timed("/api/cards?sort=valueCnyDesc&page=1");
      const thumbnailStart = performance.now();
      for (let i = 0; i < page.cards.length; i += 4) await Promise.all(page.cards.slice(i, i + 4).map(async card => {
        const response = await fetch(base + card.imagePath, { headers: { Connection: "close" } }); assert.equal(response.status, 200); await response.arrayBuffer();
      }));
      const thumbnailsMs = Math.round(performance.now() - thumbnailStart);
      const portfolio = await timed("/portfolio");
      assert.ok(!portfolio.text.includes('"digest":"'), "portfolio render must not return a streamed server error");
      db.exec("UPDATE CardValuation SET amountMinor=amountMinor+1 WHERE cardId='dense-00000'");
      assert.equal(db.prepare("SELECT COUNT(*) n FROM CardReportDirty").get().n, 1);
      const changed = await timed("/api/cards?sort=valueCnyDesc");
      await new Promise(resolve => setTimeout(resolve, 300));
      const memory = JSON.parse(fs.readFileSync(metricPath, "utf8"));
      const result = { cards: size, ledgerRows: size * 38, imageFiles: size * 2, coldMs: first.ms, warmMs: warm.ms, singleCardRefreshMs: changed.ms, portfolioMs: portfolio.ms, first24ThumbnailsMs: thumbnailsMs, rssMb: Math.round(memory.rss / 1048576), sampledPeakRssMb: Math.round(memory.peak / 1048576) };
      results.push(result);
      console.log(JSON.stringify(result));
    }
    const destination = path.resolve(__dirname, "../logs/dense-performance.json");
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, JSON.stringify({ timestamp: new Date().toISOString(), node: process.version, imageBytes: picture.length, imageDimensions: "1600x2400", memorySamplingMs: 250, results }, null, 2));
  } catch (error) { console.error(output.join("")); throw error; }
  finally { db?.close(); stopServer(server); await removeTempRoot(root); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
