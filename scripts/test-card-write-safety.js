const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const sharp = require("sharp");
const { DatabaseSync } = require("node:sqlite");
const { decodeHtmlAttribute, fetchPage, fetchTestServer } = require("./test-http-flow-utils");

function appendAction(form, html) {
  const index = html.indexOf('name="playerName"');
  const markup = html.slice(html.lastIndexOf("<form", index), html.indexOf("</form>", index));
  const fields = [...markup.matchAll(/<input type="hidden" name="(\$ACTION_[^"]+)"(?: value="([^"]*)")?\/>/g)];
  assert.ok(fields.length, "Expected a native card Server Action form");
  for (const field of fields) form.append(field[1], decodeHtmlAttribute(field[2]));
  const editVersion = markup.match(/name="editVersion" value="([^"]*)"/);
  if (editVersion) form.set("editVersion", decodeHtmlAttribute(editVersion[1]));
}

async function verifyCardWriteSafety({ baseUrl, dbPath, dataDir }) {
  const image = await sharp({ create: { width: 24, height: 36, channels: 3, background: "#cccccc" } }).png().toBuffer();
  const database = task => {
    const db = new DatabaseSync(dbPath);
    try { db.exec("PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000"); return task(db); } finally { db.close(); }
  };
  const counts = () => database(db => ({ ...db.prepare(`SELECT
    (SELECT count(*) FROM Card WHERE playerName='Write Safety Player') cards,
    (SELECT count(*) FROM CardImage WHERE cardId IN (SELECT id FROM Card WHERE playerName='Write Safety Player')) images,
    (SELECT count(*) FROM CardTransaction WHERE cardId IN (SELECT id FROM Card WHERE playerName='Write Safety Player')) transactions,
    (SELECT count(*) FROM CardValuation WHERE cardId IN (SELECT id FROM Card WHERE playerName='Write Safety Player')) valuations`).get() }));
  const form = (html, overrides = {}, upload = true) => {
    const body = new FormData();
    appendAction(body, html);
    const values = { playerName: "Write Safety Player", cardTitle: "Original", sport: "Basketball", visibility: "private", collectionStatus: "holding", initialQuantity: "2", purchasePrice: "100", purchaseDate: "2026-01-01", historyCurrency: "CNY", currentValue: "120", valuationDate: "2026-01-02", valuationSource: "个人估计", notes: "Original note", saveIntent: "view", ...overrides };
    for (const [key, value] of Object.entries(values)) body.set(key, value);
    if (upload) body.append("images", new Blob([image], { type: "image/png" }), "write-safety.png");
    return body;
  };
  const post = async (route, body) => {
    const response = await fetchTestServer(baseUrl + route, { method: "POST", body, headers: { Origin: baseUrl }, redirect: "manual", signal: AbortSignal.timeout(15_000) });
    return { status: response.status, location: response.headers.get("location"), text: await response.text() };
  };
  const cardId = response => {
    assert.equal(response.status, 303, response.text.slice(0, 500));
    const id = response.location?.match(/^\/cards\/([^?]+)/)?.[1];
    assert.ok(id, response.location);
    return id;
  };

  const blank = await fetchPage(baseUrl, "/cards/new");
  const submission = form(blank);
  const simultaneous = await Promise.all([post("/cards/new", submission), post("/cards/new", submission)]);
  const id = cardId(simultaneous[0]);
  assert.equal(cardId(simultaneous[1]), id, "Concurrent retries must return the first committed card");
  assert.equal(cardId(await post("/cards/new", submission)), id, "A lost response retry must return the same card");
  assert.deepEqual(counts(), { cards: 1, images: 1, transactions: 1, valuations: 1 });
  const another = await fetchPage(baseUrl, "/cards/new");
  assert.notEqual(cardId(await post("/cards/new", form(another))), id, "A deliberate same-card entry must remain available");
  assert.deepEqual(counts(), { cards: 2, images: 2, transactions: 2, valuations: 2 });
  console.log("Card write retries passed.");

  const draftResponse = await fetchTestServer(baseUrl + "/api/card-entry/drafts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ values: { playerName: "Write Safety Player", cardTitle: "Draft", sport: "Basketball" } }) });
  const draft = await draftResponse.json();
  assert.ok(draftResponse.ok && draft.id);
  const draftPages = await Promise.all([fetchPage(baseUrl, `/cards/new?draft=${draft.id}`), fetchPage(baseUrl, `/cards/new?draft=${draft.id}`)]);
  const draftSaves = await Promise.all(draftPages.map(html => post("/cards/new", form(html, { draftId: draft.id }))));
  assert.equal(cardId(draftSaves[0]), cardId(draftSaves[1]), "Two pages of one draft must consume it only once");
  assert.deepEqual(counts(), { cards: 3, images: 3, transactions: 3, valuations: 3 });
  assert.equal(database(db => db.prepare("SELECT count(*) n FROM CardEntryDraft WHERE id=?").get(draft.id).n), 0);
  console.log("Card write draft consumption passed.");

  const invalidPage = await fetchPage(baseUrl, "/cards/new");
  assert.equal((await post("/cards/new", form(invalidPage, { purchasePrice: "invalid" }))).status, 200);
  assert.deepEqual(counts(), { cards: 3, images: 3, transactions: 3, valuations: 3 }, "Validation failure must roll back all initial facts");
  cardId(await post("/cards/new", form(invalidPage)));
  assert.deepEqual(counts(), { cards: 4, images: 4, transactions: 4, valuations: 4 }, "A corrected retry of an uncommitted submission must work");
  console.log("Card write validation rollback passed.");

  const editRoute = `/cards/${id}/edit`, original = await fetchPage(baseUrl, editRoute);
  cardId(await post(editRoute, form(original, { cardTitle: "Saved from editor A" }, false)));
  console.log("Card write initial archive edit passed.");
  const uploadsBefore = fs.readdirSync(path.join(dataDir, "uploads")).sort();
  const stale = await post(editRoute, form(original, { notes: "Unsaved input from editor B" }));
  assert.equal(stale.status, 200);
  assert.ok(stale.text.includes("未覆盖最新内容") && stale.text.includes("Unsaved input from editor B"), "A conflict must preserve the submitted input");
  assert.deepEqual({ ...database(db => db.prepare("SELECT cardTitle,notes FROM Card WHERE id=?").get(id)) }, { cardTitle: "Saved from editor A", notes: "Original note" });
  assert.deepEqual(fs.readdirSync(path.join(dataDir, "uploads")).sort(), uploadsBefore, "Rejected stale edits must not leave uploaded files");

  const fresh = await fetchPage(baseUrl, editRoute);
  const edits = await Promise.all([
    post(editRoute, form(fresh, { cardTitle: "Concurrent A", notes: "A" }, true)),
    post(editRoute, form(fresh, { cardTitle: "Concurrent B", notes: "B" }, true))
  ]);
  assert.equal(edits.filter(result => result.status === 303).length, 1, "Exactly one concurrent archive edit must win");
  assert.ok(edits.find(result => result.status === 200)?.text.includes("未覆盖最新内容"), "The losing editor must see a conflict");
  assert.equal(database(db => db.prepare("SELECT count(*) n FROM CardImage WHERE cardId=?").get(id).n), 2);
  assert.equal(fs.readdirSync(path.join(dataDir, "uploads")).length, uploadsBefore.length + 1, "A losing concurrent upload must be removed");

  const beforeImageChange = await fetchPage(baseUrl, editRoute);
  database(db => db.prepare("UPDATE CardImage SET rotation=90 WHERE cardId=?").run(id));
  assert.ok((await post(editRoute, form(beforeImageChange, {}, false))).text.includes("未覆盖最新内容"), "Image-only changes must invalidate old editors");
  const beforeStatusChange = await fetchPage(baseUrl, editRoute);
  database(db => db.prepare("UPDATE Card SET collectionStatus='pending_grading' WHERE id=?").run(id));
  assert.ok((await post(editRoute, form(beforeStatusChange, {}, false))).text.includes("未覆盖最新内容"), "Status changes must invalidate old editors");
  const invalidImagePage = await fetchPage(baseUrl, "/cards/new");
  const invalidImageForm = form(invalidImagePage, {}, false);
  invalidImageForm.append("images", new Blob([Buffer.from([137,80,78,71,13,10,26,10])], { type: "image/png" }), "broken.png");
  const beforeInvalid = counts(), filesBeforeInvalid = fs.readdirSync(path.join(dataDir, "uploads")).sort();
  const invalidImage = await post("/cards/new", invalidImageForm);
  assert.equal(invalidImage.status, 200);
  assert.ok(invalidImage.text.includes("无法解码"));
  assert.deepEqual(counts(), beforeInvalid);
  assert.deepEqual(fs.readdirSync(path.join(dataDir, "uploads")).sort(), filesBeforeInvalid);
  cardId(await post("/cards/new", form(invalidImagePage)));

  database(db => {
    const insert = db.prepare("INSERT INTO Card(id,playerName,cardTitle,sport,certNumber,year,brand,productLine,cardNumber,parallel,createdAt) VALUES(?,'Certificate Player',?,'Basketball',?,'2024','Brand','Line','42','Gold',?)");
    insert.run("certificate-old", "Old exact certificate", "EXACT-001", "2020-01-01T00:00:00Z");
    for (let i=0; i<41; i++) insert.run(`certificate-new-${i}`, `Recent ${i}`, null, "2026-01-01T00:00:00Z");
  });
  const duplicateQuery = async (values, excludeId) => {
    const response = await fetchTestServer(baseUrl + "/api/card-entry/duplicates", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ values, excludeId }) });
    assert.equal(response.status, 200); return (await response.json()).candidates;
  };
  const duplicateValues = { playerName: "Certificate Player", certNumber: "EXACT-001", year: "2024", brand: "Brand", productLine: "Line", cardNumber: "42", parallel: "Gold" };
  for (const values of [duplicateValues, { certNumber: "EXACT-001" }, { ...duplicateValues, playerName: "Different subject" }]) {
    const candidates = await duplicateQuery(values);
    assert.equal(candidates[0]?.id, "certificate-old");
    assert.equal(candidates[0].level, "high");
    assert.equal(new Set(candidates.map(row => row.id)).size, candidates.length);
    assert.ok(candidates.length <= 5);
  }
  assert.ok(!(await duplicateQuery(duplicateValues, "certificate-old")).some(row => row.id === "certificate-old"));
  database(db => db.prepare("DELETE FROM Card WHERE playerName='Certificate Player'").run());

  const deleteRoute = `/cards/${id}/delete`;
  const deleteBody = html => {
    const body = new FormData();
    const fields = [...html.matchAll(/<input type="hidden" name="(\$ACTION_[^"]+)"(?: value="([^"]*)")?\/>/g)];
    assert.ok(fields.length);
    for (const field of fields) body.append(field[1], decodeHtmlAttribute(field[2]));
    return body;
  };
  const dependentState = () => database(db => JSON.stringify(Object.fromEntries(["Card", "CardImage", "CardTransaction", "CardExpense", "CardValuation", "ShareCollectionItem", "ScoutWishCard"].map(table => [table, db.prepare(`SELECT * FROM ${table} WHERE ${table === "Card" ? "id" : "cardId"}=?`).all(id)]))));
  const mediaBeforeDelete = fs.readdirSync(path.join(dataDir, "uploads")).sort();
  const mutations = [
    db => db.prepare("UPDATE Card SET notes='Changed after confirmation' WHERE id=?").run(id),
    db => db.prepare("UPDATE CardImage SET rotation=180 WHERE cardId=?").run(id),
    db => db.prepare("UPDATE CardTransaction SET amountMinor=amountMinor+1 WHERE cardId=?").run(id),
    db => db.prepare("INSERT INTO CardExpense(id,cardId,kind,amountMinor,currency,occurredAt,provenance) VALUES('delete-expense',?,'grading',100,'CNY','2026-01-01T00:00:00Z','test')").run(id),
    db => db.prepare("UPDATE CardValuation SET amountMinor=amountMinor+1 WHERE cardId=?").run(id),
    db => { db.prepare("INSERT INTO ShareCollection(id,title,slug) VALUES('delete-share','Delete guard','delete-guard')").run(); db.prepare("INSERT INTO ShareCollectionItem(id,shareCollectionId,cardId) VALUES('delete-share-item','delete-share',?)").run(id); },
    db => { db.prepare("INSERT INTO CollectionPlan(id,title) VALUES('delete-wish','Delete guard')").run(); db.prepare("INSERT INTO ScoutWishCard(planId,cardId) VALUES('delete-wish',?)").run(id); }
  ];
  for (const mutate of mutations) {
    const confirmation = await fetchPage(baseUrl, deleteRoute);
    database(mutate);
    const preserved = dependentState();
    const rejected = await post(deleteRoute, deleteBody(confirmation));
    assert.equal(rejected.status, 303);
    assert.ok(decodeURIComponent(rejected.location).includes("未执行删除"));
    assert.deepEqual(dependentState(), preserved, "A stale confirmation must preserve every dependent record");
    assert.deepEqual(fs.readdirSync(path.join(dataDir, "uploads")).sort(), mediaBeforeDelete);
  }
  const imagePaths = database(db => db.prepare("SELECT path FROM CardImage WHERE cardId=?").all(id).map(row => path.join(dataDir, "uploads", path.basename(row.path))));
  const freshDelete = await post(deleteRoute, deleteBody(await fetchPage(baseUrl, deleteRoute)));
  assert.equal(freshDelete.location, "/?success=deleted");
  assert.ok(Object.values(JSON.parse(dependentState())).every(rows => rows.length === 0));
  assert.ok(imagePaths.every(file => !fs.existsSync(file)));
  database(db => { db.prepare("DELETE FROM ShareCollection WHERE id='delete-share'").run(); db.prepare("DELETE FROM CollectionPlan WHERE id='delete-wish'").run(); });
  console.log("Patch safety passed: invalid image rollback/retry, old exact certificates, stale deletion of archives/media/financial facts/share/wish references and fresh confirmed deletion.");
  console.log("Card write safety passed: concurrent/sequential retries, same draft across pages, legitimate copies, validation rollback, stale/concurrent edits, image/status conflicts and upload cleanup.");
}

module.exports = { verifyCardWriteSafety };
