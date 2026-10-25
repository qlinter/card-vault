const assert = require("node:assert/strict"), fs = require("node:fs"), os = require("node:os"), path = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const ExcelJS = require("exceljs");
const { parseCsv } = require("../lib/tabular-data");
const { fetchTestServer: fetch, fileDatabaseUrl, findAvailablePort, initializeTestDatabase, removeTempRoot, startTestServer, stopServer, waitForServer } = require("./test-http-flow-utils");
async function main() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "card-vault-management-")), dataDir = path.join(root, "data"), dbPath = path.join(dataDir, "dev.db");
  const port = await findAvailablePort(3370), base = `http://127.0.0.1:${port}`, output = [];
  const env = { ...process.env, CARD_VAULT_DATA_DIR: dataDir, DATABASE_URL: fileDatabaseUrl(dbPath), NODE_ENV: "production" };
  let server, db;
  async function post(body, route = "/api/data-center") { const response = await fetch(base + route, { method: "POST", headers: { "Content-Type": "application/json", Origin: base }, body: JSON.stringify(body) }); const data = await response.json(); assert.equal(response.status, 200, JSON.stringify(data)); return data; }
  async function get(route) { const response = await fetch(base + route); const body = await response.text(); assert.equal(response.status, 200, body); return JSON.parse(body); }
  async function all(id, action) {
    let cursor;
    do {
      const result = await post({ id, action, cursor });
      assert.equal(result.delta, true); assert.ok(result.rows.length <= 50);
      assert.ok(result.rows.every(row => !("values" in row)), "chunk responses must omit input values");
      cursor = result.nextCursor ?? undefined;
    } while (cursor !== undefined);
    return get(`/api/data-center?id=${id}`);
  }
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
    // Retired jobs must not be read, executed, undone or re-previewed.
    const retired = await post({ action: "preview", headers: ["id"], rows: [[cardId]], mapping: { id: "id" }, policy: "update" });
    db.prepare("UPDATE BulkJob SET kind='valuation', optionsJson=? WHERE id=?").run(JSON.stringify({ kind: "valuation", policy: "update" }), retired.id);
    for (const action of ["apply", "undo", "repreview"]) {
      const response = await fetch(base + "/api/data-center", { method: "POST", headers: { "Content-Type": "application/json", Origin: base }, body: JSON.stringify({ action, id: retired.id }) });
      assert.equal(response.status, 400);
    }
    assert.equal(db.prepare("SELECT COUNT(*) n FROM CardValuation WHERE cardId=?").get(cardId).n, 1);
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
    const paged = await post({ action: "preview", headers: ["playerName", "cardTitle", "sport"], mapping: { playerName: "playerName", cardTitle: "cardTitle", sport: "sport" }, policy: "separate", rows: Array.from({ length: 205 }, (_, i) => ["Paged", `Card ${i}`, "Basketball"]) });
    assert.equal(paged.total, 205); assert.equal(paged.rows.length, 100); assert.equal(paged.counts.pending, 205);
    const secondPage = await get(`/api/data-center?id=${paged.id}&after=${paged.nextRow}`);
    const finalPage = await get(`/api/data-center?id=${paged.id}&after=${secondPage.nextRow}`);
    assert.equal(new Set([...paged.rows, ...secondPage.rows, ...finalPage.rows].map(row => row.id)).size, 205);
    assert.equal(finalPage.nextRow, null);
    const pagedResult = await all(paged.id, "apply");
    assert.equal(pagedResult.counts.applied, 205); assert.equal(pagedResult.rows.length, 100);
    const duplicatePreview = await post({ action: "preview", headers: ["playerName", "cardTitle", "sport"], mapping: { playerName: "playerName", cardTitle: "cardTitle", sport: "sport" }, policy: "separate", rows: [["Paged", "Card 0", "Basketball"], ["Paged", "Card 0", "Basketball"]] });
    await all(duplicatePreview.id, "apply");
    const ambiguous = await post({ action: "preview", headers: ["playerName", "cardTitle", "sport"], mapping: { playerName: "playerName", cardTitle: "cardTitle", sport: "sport" }, policy: "skip", rows: [["Paged", "Card 0", "Basketball"]] });
    assert.match(ambiguous.rows[0].error, /匹配到多张/);
    const independent = await post({ action: "preview", headers: ["playerName", "cardTitle", "sport"], mapping: { playerName: "playerName", cardTitle: "cardTitle", sport: "sport" }, policy: "separate", rows: [["Paged", "Card 0", "Basketball"]] });
    assert.equal(independent.rows[0].status, "pending");
    const missingId = await post({ action: "preview", headers: ["id"], mapping: { id: "id" }, policy: "update", rows: [["not-present"]] });
    assert.match(missingId.rows[0].error, /卡片 ID 不存在/);
    await all(duplicatePreview.id, "undo");
    await all(paged.id, "undo"); assert.equal(db.prepare("SELECT COUNT(*) n FROM Card").get().n, 1);
    const exportResponse = await fetch(base + "/api/data-center?export=xlsx"); assert.equal(exportResponse.status, 200); const exported = new ExcelJS.Workbook(); await exported.xlsx.load(Buffer.from(await exportResponse.arrayBuffer())); assert.equal(exported.worksheets[0].name, "Cards"); assert.equal(exported.getWorksheet("Financial history").rowCount, 3);
    const invalidExport = await fetch(base + "/api/data-center?export=pdf"); assert.equal(invalidExport.status, 400);
    const publicXlsxResponse = await fetch(base + "/api/data-center?export=xlsx&publicOnly=true"); assert.equal(publicXlsxResponse.status, 200);
    const publicBook = new ExcelJS.Workbook(); await publicBook.xlsx.load(Buffer.from(await publicXlsxResponse.arrayBuffer())); assert.deepEqual(publicBook.worksheets.map(sheet => sheet.name), ["Cards"]);
    assert.ok(!publicBook.worksheets[0].getRow(1).values.includes("notes"));
    const publicResponse = await fetch(base + "/api/data-center?export=csv&publicOnly=true"); assert.ok(!(await publicResponse.text()).includes("Later edit"));
    db.exec("INSERT INTO Card(id,playerName,cardTitle,sport,visibility) VALUES('export-other','Export other','Other card','Basketball','public')");
    const selectedExport = async (ids, publicOnly = false) => fetch(base + "/api/data-center", { method: "POST", headers: { Origin: base }, body: new URLSearchParams({ action: "export", format: "csv", ids: JSON.stringify(ids), publicOnly: String(publicOnly) }) });
    const selectedCsv = parseCsv(await (await selectedExport([cardId])).text());
    assert.equal(selectedCsv.rows.length, 1);
    assert.equal(selectedCsv.rows[0][selectedCsv.headers.indexOf("id")], cardId);
    const publicSelected = parseCsv(await (await selectedExport([cardId, "export-other"], true)).text());
    assert.equal(publicSelected.rows.length, 1);
    assert.equal(publicSelected.rows[0][publicSelected.headers.indexOf("id")], "export-other");
    assert.equal((await selectedExport([])).status, 400);
    assert.equal((await (await selectedExport(["deleted-card"])).text()).trim().split(/\r?\n/).length, 1);
    db.exec("UPDATE Card SET team='A&B / 队',brand='Export brand',year='2024',isAutograph=0 WHERE id='export-other'");
    const scope = { q: "Export", team: "A&B / 队", brand: "Export brand", year: "2024", isAutograph: "false", visibility: "public", collectionStatus: "holding" };
    const selectedIds = await get("/api/data-center?" + new URLSearchParams({ ...scope, selection: "true" }));
    assert.deepEqual(selectedIds.ids, ["export-other"]);
    async function scopedExport(extra = {}) {
      const response = await fetch(base + "/api/data-center", { method: "POST", headers: { Origin: base }, body: new URLSearchParams({ action: "export", format: "csv", ...scope, ids: JSON.stringify([cardId, "export-other"]), ...extra }) });
      assert.equal(response.status, 200); return response;
    }
    const scopedCsv = parseCsv(await (await scopedExport()).text());
    assert.equal(scopedCsv.rows.length, 1);
    assert.equal(scopedCsv.rows[0][scopedCsv.headers.indexOf("id")], "export-other");
    assert.equal((await (await scopedExport({ team: "different" })).text()).trim().split(/\r?\n/).length, 1);
    assert.equal((await (await scopedExport({ isAutograph: "true" })).text()).trim().split(/\r?\n/).length, 1);
    const scopedBook = new ExcelJS.Workbook();
    await scopedBook.xlsx.load(Buffer.from(await (await scopedExport({ format: "xlsx", publicOnly: "true" })).arrayBuffer()));
    assert.deepEqual(scopedBook.worksheets.map(sheet => sheet.name), ["Cards"]);
    assert.equal(scopedBook.worksheets[0].rowCount, 2);
    assert.ok(!scopedBook.worksheets[0].getRow(1).values.includes("notes"));
    db.exec("DELETE FROM Card WHERE id='export-other'");
    assert.equal(exported.getWorksheet("Financial history").getRow(1).getCell(15).text, "transactionId");
    assert.equal(exported.getWorksheet("Financial history").getRow(2).getCell(14).text, "12025");
    const management = await get("/api/home-overview?tasks=1&handled=1"); const reminder = management.tasks.find(task => task.kind === "images"); assert.ok(reminder);
    for (const invalid of [{ id: reminder.id, fingerprint: "stale" }, { id: "deleted-card:images", fingerprint: reminder.fingerprint }, { id: "invalid", fingerprint: reminder.fingerprint }, { id: `${cardId}:invalid`, fingerprint: reminder.fingerprint }]) {
      const response = await fetch(base + "/api/collection-management", { method: "POST", headers: { "Content-Type": "application/json", Origin: base }, body: JSON.stringify({ action: "task", status: "done", ...invalid }) });
      assert.equal(response.status, 400);
    }
    await post({ action: "task", id: reminder.id, fingerprint: reminder.fingerprint, status: "snoozed" }, "/api/collection-management"); assert.equal((await get("/api/home-overview?tasks=1&handled=1")).tasks.find(task => task.id === reminder.id).state, "snoozed");
    db.exec("INSERT INTO Card(id,playerName,cardTitle,sport,collectionStatus,updatedAt) VALUES('review-grading','Review scope','Grade old','Basketball','grading','2025-01-01T00:00:00.000Z'),('review-listed','Review scope','Listed old','Basketball','listed','2025-01-01T00:00:00.000Z')");
    db.exec("UPDATE CardTracking SET statusStartedAt='2025-01-01T00:00:00.000Z' WHERE cardId IN ('review-grading','review-listed')");
    const follow = await get("/api/home-overview?review=followup&tasks=1&q=Review+scope");
    assert.equal(follow.followupOpenCount, 2);
    assert.deepEqual(new Set(follow.tasks.map(task => task.kind)), new Set(["grading", "listed"]));
    assert.equal((await get("/api/home-overview?review=followup&tasks=1&q=Review+scope&reviewSearch=Grade")).tasks.length, 1);
    assert.equal((await get("/api/home-overview?review=followup&tasks=1&q=Review+scope&reviewSearch=Import")).tasks.length, 0);
    const grading = follow.tasks.find(task => task.kind === "grading");
    await post({ action: "task", id: grading.id, fingerprint: grading.fingerprint, status: "done" }, "/api/collection-management");
    assert.equal((await get("/api/home-overview?review=followup&tasks=1&q=Review+scope")).followupOpenCount, 1);
    assert.ok((await get("/api/home-overview?review=followup&tasks=1&handled=1&q=Review+scope")).tasks.some(task => task.id === grading.id && task.state === "done"));
    assert.ok((await get("/api/home-overview?review=followup&tasks=1&handled=1")).tasks.some(task => task.id === reminder.id && task.state === "snoozed"));
    db.exec("DELETE FROM Card WHERE id IN ('review-grading','review-listed'); DELETE FROM CollectionTaskState WHERE id LIKE 'review-%'");
    const wishId = (await post({ action: "wish", title: "愿望清单", budget: "123.45", currency: "CNY" }, "/api/scout")).id;
    assert.equal((await get("/api/scout")).plans.find(plan => plan.id === wishId).budgetMinor, "12345");
    await post({ action: "wish", title: "保留心愿", budget: "10.00", currency: "CNY" }, "/api/scout");
    for (const id of ["", "missing-wish"]) {
      const response = await fetch(base + "/api/scout", { method: "POST", headers: { "Content-Type": "application/json", Origin: base }, body: JSON.stringify({ action: "wish-delete", id }) });
      assert.equal(response.status, 400);
    }
    await post({ action: "wish-delete", id: wishId }, "/api/scout");
    const afterWishDelete = await get("/api/scout");
    assert.equal(afterWishDelete.plans.some(plan => plan.id === wishId), false);
    assert.equal(afterWishDelete.plans.some(plan => plan.title === "保留心愿"), true);
    assert.equal(afterWishDelete.plans.find(plan => plan.title === "保留心愿").budgetMinor, "1000");
    await post({ action: "task", id: reminder.id, fingerprint: reminder.fingerprint, status: "open" }, "/api/collection-management");
    await post({ action: "task", id: reminder.id, fingerprint: reminder.fingerprint, status: "done" }, "/api/collection-management");
    db.prepare("INSERT INTO CardImage(id,cardId,path) VALUES('recurring-image',?,'/media/example.webp')").run(cardId);
    assert.ok(!(await get("/api/home-overview?tasks=1&handled=1")).tasks.some(task => task.id === reminder.id));
    db.exec("DELETE FROM CardImage WHERE id='recurring-image'");
    assert.equal((await get("/api/home-overview?tasks=1&handled=1")).tasks.find(task => task.id === reminder.id).state, "open");
    await post({ action: "settings", digestCadence: "monthly" }, "/api/collection-management");
    const monthly = await get("/api/home-overview?tasks=1&handled=1");
    assert.equal(monthly.digest.days, 30);
    assert.equal("notificationDue" in monthly, false);
    assert.equal(monthly.cadence, "monthly");

    // Dense history and mixed SQLite date encodings must preserve digest semantics.
    const baseline = await get("/api/home-overview?tasks=1&handled=1");
    const clock = Date.now(), recent = clock - 2 * 86400000, future = clock + 2 * 86400000;
    db.exec("PRAGMA foreign_keys=ON");
    const fixtureCard = db.prepare("INSERT INTO Card(id,playerName,cardTitle,sport,createdAt) VALUES(?, 'History fixture', 'Boundary', 'Basketball', ?)");
    fixtureCard.run("digest-text", new Date(recent).toISOString());
    fixtureCard.run("digest-numeric", recent);
    fixtureCard.run("digest-future", future);
    const fixtureBuy = db.prepare("INSERT INTO CardTransaction(id,cardId,kind,amountMinor,currency,occurredAt,provenance,amountKnown) VALUES(?,?,'purchase',0,'CNY',?,'test',0)");
    const fixtureValue = db.prepare("INSERT INTO CardValuation(id,cardId,amountMinor,currency,valuedAt,source,provenance) VALUES(?,?,100,'CNY',?,'个人估计','test')");
    for (const [id, date] of [["digest-text", new Date(recent).toISOString()], ["digest-numeric", recent], ["digest-future", future]]) {
      fixtureBuy.run(id, id, date); fixtureValue.run(id, id, date);
    }
    for (let n = 0; n < 300; n++) fixtureValue.run("old-" + n, "digest-future", new Date(clock - (200 + n) * 86400000).toISOString());
    const dense = await get("/api/home-overview?tasks=1&handled=1");
    assert.equal(dense.digest.newCards, baseline.digest.newCards + 2);
    assert.equal(dense.digest.purchases, baseline.digest.purchases + 2);
    assert.equal(dense.digest.valuations, baseline.digest.valuations + 2);
    assert.ok(dense.tasks.some(task => task.cardId === "digest-text" && task.kind === "purchase"));
    assert.ok(dense.tasks.some(task => task.cardId === "digest-future" && task.kind === "stale" && task.days === 200));
    db.exec("DELETE FROM Card WHERE id IN ('digest-text','digest-numeric','digest-future')");

    const insert = db.prepare("INSERT INTO Card(id,playerName,cardTitle,sport,holdingQuantity) VALUES(?,?,?,?,1)"), buy = db.prepare("INSERT INTO CardTransaction(id,cardId,kind,amountMinor,currency,quantity,occurredAt,provenance) VALUES(?,?,'purchase',?,'CNY',1,'2026-01-01T00:00:00.000Z','benchmark')"), valuation = db.prepare("INSERT INTO CardValuation(id,cardId,amountMinor,currency,valuedAt,source,provenance) VALUES(?,?,?,'CNY','2026-08-01T00:00:00.000Z','个人估计','benchmark')");
    let seeded = 1; const benchmarks = [];
    for (const size of process.argv.includes("--benchmark") ? [1000, 5000, 10000] : [60]) {
      db.exec("BEGIN"); for (; seeded < size; seeded++) { const id = `perf-${String(seeded).padStart(5,"0")}`; insert.run(id, "Benchmark", `Card ${seeded}`, "Basketball"); buy.run(`buy-${id}`, id, seeded * 100); valuation.run(`value-${id}`, id, seeded * 2000); } db.exec("COMMIT");
      const start = performance.now(); const first = await get("/api/cards?sort=valueCnyDesc"); const coldMs = performance.now() - start;
      const warmStart = performance.now(); const second = await get("/api/cards?sort=valueCnyDesc&page=1"); const warmMs = performance.now() - warmStart;
      assert.equal(first.totalCount, size); assert.equal(first.cards.length, 24); assert.equal(second.cards.length, 24); assert.equal(new Set([...first.cards, ...second.cards].map(card => card.id)).size, 48);
      assert.equal(first.cards[0].id, `perf-${String(size - 1).padStart(5,"0")}`);
      // Instrument report writes: metadata edits must cause none, a quote edit one.
      db.exec("CREATE TABLE IF NOT EXISTS ReportWrites(cardId TEXT); CREATE TRIGGER IF NOT EXISTS audit_report_insert AFTER INSERT ON CardReport BEGIN INSERT INTO ReportWrites VALUES(NEW.cardId); END; DELETE FROM ReportWrites;");
      db.exec("UPDATE Card SET notes='metadata only' WHERE id='perf-00001'");
      await get("/api/cards");
      assert.equal(db.prepare("SELECT COUNT(*) n FROM ReportWrites").get().n, 0);
      db.exec("UPDATE CardValuation SET amountMinor=123456 WHERE cardId='perf-00001'");
      await get("/api/cards");
      assert.deepEqual(db.prepare("SELECT cardId FROM ReportWrites").all().map(row => row.cardId), ["perf-00001"]);
      assert.equal(db.prepare("SELECT valueMinor FROM CardReport WHERE cardId='perf-00001'").get().valueMinor, 123456);
      db.exec("DELETE FROM ReportWrites; DELETE FROM CardReport WHERE cardId='perf-00001'; INSERT OR IGNORE INTO CardReportDirty VALUES('perf-00001'),('perf-00002'); UPDATE DataRevision SET projectionRevision=-1 WHERE id=1;");
      await get("/api/cards");
      assert.equal(db.prepare("SELECT COUNT(*) n FROM CardReportDirty").get().n, 0);
      assert.deepEqual(db.prepare("SELECT cardId FROM ReportWrites ORDER BY cardId").all().map(row => row.cardId), ["perf-00001", "perf-00002"]);
      const today = new Date().toISOString().slice(0, 10);
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      db.prepare("UPDATE CardValuation SET valuedAt=? WHERE cardId='perf-00001'").run(today + "T00:00:00.000Z");
      await get("/api/cards");
      db.exec("UPDATE CardReport SET valueMinor=NULL WHERE cardId='perf-00001'; DELETE FROM ReportWrites");
      db.prepare("UPDATE DataRevision SET projectionDay=? WHERE id=1").run(yesterday);
      await get("/api/cards");
      assert.equal(db.prepare("SELECT valueMinor FROM CardReport WHERE cardId='perf-00001'").get().valueMinor, 123456);
      assert.deepEqual(db.prepare("SELECT cardId FROM ReportWrites").all().map(row => row.cardId), ["perf-00001"]);
      db.exec("DROP TRIGGER audit_report_insert; DROP TABLE ReportWrites;");
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
