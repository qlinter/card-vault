const assert = require("node:assert/strict"), fs = require("node:fs"), os = require("node:os"), path = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const ExcelJS = require("exceljs");
const { fileDatabaseUrl, findAvailablePort, initializeTestDatabase, removeTempRoot, startTestServer, stopServer, waitForServer } = require("./test-http-flow-utils");
async function main() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "card-vault-management-")), dataDir = path.join(root, "data"), dbPath = path.join(dataDir, "dev.db");
  const port = await findAvailablePort(3370), base = `http://127.0.0.1:${port}`, output = [];
  const env = { ...process.env, CARD_VAULT_DATA_DIR: dataDir, DATABASE_URL: fileDatabaseUrl(dbPath), NODE_ENV: "production" };
  let server, db;
  async function post(body, route = "/api/data-center") { const response = await fetch(base + route, { method: "POST", headers: { "Content-Type": "application/json", Origin: base }, body: JSON.stringify(body) }); const data = await response.json(); assert.equal(response.status, 200, JSON.stringify(data)); return data; }
  async function get(route) { const response = await fetch(base + route); assert.equal(response.status, 200, await response.clone().text()); return response.json(); }
  async function all(id, action) { let cursor, result; do { result = await post({ id, action, cursor }); cursor = result.nextCursor ?? undefined; } while (cursor !== undefined); return result; }
  try {
    initializeTestDatabase(env); server = startTestServer(port, env, output); await waitForServer(base, output, server, "Management"); db = new DatabaseSync(dbPath);
    const headers = ["playerName", "cardTitle", "sport", "purchasePrice", "purchaseDate", "currentValue", "valuationDate", "valuationSource"];
    const mapping = Object.fromEntries(headers.map(key => [key, key]));
    const input = { action: "preview", headers, mapping, policy: "skip", rows: [["卡片数量", "备注", "Basketball", "120.25", "2026-01-01", "150", "2026-08-01", "个人估计"], ["Invalid", "Missing date", "Basketball", "42", "", "", "", ""]] };
    const preview = await post(input); assert.equal(preview.rows[0].status, "pending"); assert.equal(preview.rows[1].status, "failed"); assert.equal(db.prepare("SELECT COUNT(*) n FROM Card").get().n, 0);
    const result = await all(preview.id, "apply"); assert.equal(result.status, "partial"); const cardId = result.rows[0].cardId;
    assert.equal(db.prepare("SELECT holdingQuantity FROM Card WHERE id=?").get(cardId).holdingQuantity, 1);
    assert.equal(db.prepare("SELECT amountMinor FROM CardTransaction WHERE cardId=?").get(cardId).amountMinor, 12025);
    assert.equal((await post(input)).id, preview.id); await all(preview.id, "apply"); assert.equal(db.prepare("SELECT COUNT(*) n FROM Card").get().n, 1);
    const updatePreview = (field, value) => post({ action: "preview", headers: ["id", field], rows: [[cardId, value]], mapping: { id: "id", [field]: field }, policy: "update" });
    const removedBulk = await fetch(base + "/api/data-center", { method: "POST", headers: { "Content-Type": "application/json", Origin: base }, body: JSON.stringify({ action: "bulk", ids: [cardId], field: "tags", value: "retired" }) });
    assert.equal(removedBulk.status, 400);
    const bulk = await updatePreview("tags", "Tag,核心"); await all(bulk.id, "apply");
    assert.equal(db.prepare("SELECT tags FROM Card WHERE id=?").get(cardId).tags, "Tag,核心");
    await all(bulk.id, "undo"); assert.equal(db.prepare("SELECT tags FROM Card WHERE id=?").get(cardId).tags, null);
    // Existing valuation jobs from earlier v1.3.0 builds must still execute and undo.
    const valueJob = await post({ action: "preview", headers: ["id"], rows: [[cardId]], mapping: { id: "id" }, policy: "update" });
    const legacyRow = db.prepare("SELECT inputJson FROM BulkJobRow WHERE jobId=?").get(valueJob.id);
    const legacyInput = JSON.parse(legacyRow.inputJson);
    legacyInput.values = { id: cardId, currentValue: "199.99", historyCurrency: "CNY", valuationDate: "2026-09-01", valuationSource: "近期成交" };
    db.prepare("UPDATE BulkJob SET kind='valuation', optionsJson=? WHERE id=?").run(JSON.stringify({ kind: "valuation", policy: "update" }), valueJob.id);
    db.prepare("UPDATE BulkJobRow SET inputJson=? WHERE jobId=?").run(JSON.stringify(legacyInput), valueJob.id);
    await all(valueJob.id, "apply"); assert.equal(db.prepare("SELECT COUNT(*) n FROM CardValuation WHERE cardId=?").get(cardId).n, 2);
    await all(valueJob.id, "undo"); assert.equal(db.prepare("SELECT COUNT(*) n FROM CardValuation WHERE cardId=?").get(cardId).n, 1);
    const conflict = await updatePreview("notes", "Batch notes"); await all(conflict.id, "apply");
    db.prepare("UPDATE Card SET notes='Later edit' WHERE id=?").run(cardId); assert.equal((await all(conflict.id, "undo")).rows[0].status, "undo-failed");
    assert.equal(db.prepare("SELECT notes FROM Card WHERE id=?").get(cardId).notes, "Later edit");
    const book = new ExcelJS.Workbook(); book.addWorksheet("Cards").addRows([["playerName", "cardTitle", "sport"], ["XLSX name", "00123", "Football"]]);
    const form = new FormData(); form.set("file", new Blob([await book.xlsx.writeBuffer()]), "cards.xlsx");
    const upload = await fetch(base + "/api/data-center", { method: "POST", headers: { Origin: base }, body: form }); assert.equal(upload.status, 200); const table = await upload.json(); assert.equal(table.rows[0][1], "00123");
    const xlsxJob = await post({ action: "preview", ...table, mapping: { playerName: "playerName", cardTitle: "cardTitle", sport: "sport" }, policy: "skip" }); await all(xlsxJob.id, "apply"); await all(xlsxJob.id, "undo"); assert.equal(db.prepare("SELECT COUNT(*) n FROM Card").get().n, 1);
    const multi = await post({ action: "preview", headers: table.headers, mapping: { playerName: "playerName", cardTitle: "cardTitle", sport: "sport" }, policy: "skip", rows: [["Invalid row", "", "Basketball"], ...Array.from({ length: 61 }, (_, i) => ["Chunked", `Card ${i}`, "Basketball"])] });
    const multiResult = await all(multi.id, "apply"); assert.equal(multiResult.rows.filter(row => row.status === "applied").length, 61); assert.equal(multiResult.rows.filter(row => row.status === "failed").length, 1);
    await all(multi.id, "undo"); assert.equal(db.prepare("SELECT COUNT(*) n FROM Card").get().n, 1);
    const exportResponse = await fetch(base + "/api/data-center?export=xlsx"); assert.equal(exportResponse.status, 200); const exported = new ExcelJS.Workbook(); await exported.xlsx.load(Buffer.from(await exportResponse.arrayBuffer())); assert.equal(exported.worksheets[0].name, "Cards"); assert.equal(exported.getWorksheet("Financial history").rowCount, 3);
    const invalidExport = await fetch(base + "/api/data-center?export=pdf"); assert.equal(invalidExport.status, 400);
    const publicXlsxResponse = await fetch(base + "/api/data-center?export=xlsx&publicOnly=true"); assert.equal(publicXlsxResponse.status, 200);
    const publicBook = new ExcelJS.Workbook(); await publicBook.xlsx.load(Buffer.from(await publicXlsxResponse.arrayBuffer())); assert.deepEqual(publicBook.worksheets.map(sheet => sheet.name), ["Cards"]);
    assert.ok(!publicBook.worksheets[0].getRow(1).values.includes("notes"));
    const publicResponse = await fetch(base + "/api/data-center?export=csv&publicOnly=true"); assert.ok(!(await publicResponse.text()).includes("Later edit"));
    assert.equal(exported.getWorksheet("Financial history").getRow(1).getCell(15).text, "transactionId");
    assert.equal(exported.getWorksheet("Financial history").getRow(2).getCell(14).text, "12025");
    const management = await get("/api/collection-management"); const reminder = management.tasks.find(task => task.kind === "images"); assert.ok(reminder);
    await post({ action: "task", id: reminder.id, fingerprint: reminder.fingerprint, status: "snoozed" }, "/api/collection-management"); assert.equal((await get("/api/collection-management")).tasks.find(task => task.id === reminder.id).state, "snoozed");
    await post({ action: "plan", title: "愿望清单", budget: "123.45", currency: "CNY" }, "/api/collection-management"); assert.equal((await get("/api/collection-management")).budgets.CNY, "12345");
    await post({ action: "task", id: reminder.id, fingerprint: reminder.fingerprint, status: "open" }, "/api/collection-management");
    await post({ action: "settings", digestCadence: "monthly" }, "/api/collection-management");
    const monthly = await get("/api/collection-management");
    assert.equal(monthly.digest.days, 30);
    assert.equal("notificationDue" in monthly, false);
    assert.equal("notifications" in monthly.settings, false);

    const insert = db.prepare("INSERT INTO Card(id,playerName,cardTitle,sport,holdingQuantity) VALUES(?,?,?,?,1)"), buy = db.prepare("INSERT INTO CardTransaction(id,cardId,kind,amountMinor,currency,quantity,occurredAt,provenance) VALUES(?,?,'purchase',?,'CNY',1,'2026-01-01T00:00:00.000Z','benchmark')"), valuation = db.prepare("INSERT INTO CardValuation(id,cardId,amountMinor,currency,valuedAt,source,provenance) VALUES(?,?,?,'CNY','2026-08-01T00:00:00.000Z','个人估计','benchmark')");
    let seeded = 1; const benchmarks = [];
    for (const size of process.argv.includes("--benchmark") ? [1000, 5000, 10000] : [60]) {
      db.exec("BEGIN"); for (; seeded < size; seeded++) { const id = `perf-${String(seeded).padStart(5,"0")}`; insert.run(id, "Benchmark", `Card ${seeded}`, "Basketball"); buy.run(`buy-${id}`, id, seeded * 100); valuation.run(`value-${id}`, id, seeded * 2000); } db.exec("COMMIT");
      const start = performance.now(); const first = await get("/api/cards?sort=valueCnyDesc"); const coldMs = performance.now() - start;
      const warmStart = performance.now(); const second = await get("/api/cards?sort=valueCnyDesc&page=1"); const warmMs = performance.now() - warmStart;
      assert.equal(first.totalCount, size); assert.equal(first.cards.length, 24); assert.equal(second.cards.length, 24); assert.equal(new Set([...first.cards, ...second.cards].map(card => card.id)).size, 48);
      assert.equal(first.cards[0].id, `perf-${String(size - 1).padStart(5,"0")}`);
      let portfolioMs = null;
      if (process.argv.includes("--benchmark")) { const portfolioStart = performance.now(); const response = await fetch(base + "/portfolio"); assert.equal(response.status, 200); const html = await response.text(); assert.ok(!html.includes("请缩小范围后重试")); portfolioMs = performance.now() - portfolioStart; }
      const serverRssMb = process.platform === "win32" && process.argv.includes("--benchmark") ? Math.round(Number(require("node:child_process").execFileSync("powershell.exe", ["-NoProfile", "-Command", "(Get-Process -Id " + server.pid + ").WorkingSet64"], { encoding: "utf8", windowsHide: true }).trim()) / 1024 / 1024) : null;
      benchmarks.push({ serverRssMb, cards: size, coldMs: Math.round(coldMs), warmMs: Math.round(warmMs), portfolioMs: portfolioMs === null ? null : Math.round(portfolioMs), listBytes: Buffer.byteLength(JSON.stringify(first)) });
    }
    if (process.argv.includes("--benchmark")) { fs.mkdirSync(path.join(__dirname,"../logs"),{recursive:true}); fs.writeFileSync(path.join(__dirname,"../logs/v130-performance.json"), JSON.stringify({ timestamp: new Date().toISOString(), node: process.version, platform: process.platform, results: benchmarks }, null, 2)); }
    console.log("Management HTTP passed: preview, XLSX, idempotency, financial facts, undo conflicts, reminders, plans, pagination and sorting."); console.log(JSON.stringify(benchmarks));
  } catch (error) { console.error(output.join("")); throw error; }
  finally { db?.close(); stopServer(server); await removeTempRoot(root); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
