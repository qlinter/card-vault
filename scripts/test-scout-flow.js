const assert = require("node:assert/strict"), fs = require("node:fs"), os = require("node:os"), path = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const { fetchTestServer: fetch, fileDatabaseUrl, findAvailablePort, initializeTestDatabase, removeTempRoot, startTestServer, stopServer, waitForServer } = require("./test-http-flow-utils");
async function main() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "vault-scout-http-")), dataDir = path.join(root, "data"), dbPath = path.join(dataDir, "dev.db");
  const port = await findAvailablePort(3380), base = "http://127.0.0.1:" + port, output = [];
  const env = { ...process.env, CARD_VAULT_DATA_DIR: dataDir, DATABASE_URL: fileDatabaseUrl(dbPath), NODE_ENV: "production" };
  let server, db;
  async function post(body, status = 200) {
    const response = await fetch(base + "/api/scout", { method: "POST", headers: { "Content-Type": "application/json", Origin: base }, body: JSON.stringify(body) });
    const result = await response.json(); assert.equal(response.status, status, JSON.stringify(result)); return result;
  }
  async function get(route = "/api/scout") {
    const response = await fetch(base + route); const result = await response.json();
    assert.equal(response.status, 200, JSON.stringify(result)); return result;
  }
  try {
    initializeTestDatabase(env);
    db = new DatabaseSync(dbPath); db.exec("PRAGMA foreign_keys=ON");
    db.exec("INSERT INTO Card(id,playerName,cardTitle,sport) VALUES('held','Jordan','Gold','Basketball'); INSERT INTO CollectionPlan(id,title) VALUES('old','History'); INSERT INTO ScoutWatch(id,title,queryJson) VALUES('old-watch','Keyword','{}'); INSERT INTO ScoutWishCard(planId,cardId) VALUES('old','held'); INSERT INTO ScoutWishWatch(planId,watchId) VALUES('old','old-watch')");
    server = startTestServer(port, env, output); await waitForServer(base, output, server, "Scout");
    assert.equal((await get()).plans[0].id, "old");
    assert.equal(db.prepare("SELECT count(*) n FROM Card").get().n, 1);
    const tables = ["ScoutWatch", "ScoutWishCard", "ScoutWishWatch", "ScoutWishDetails"];
    for (const table of tables) assert.equal(db.prepare("SELECT count(*) n FROM " + table).get().n, table === "ScoutWishDetails" ? 0 : 1);
    await post({ action: "wish-delete", id: "old" });
    db.exec("DELETE FROM ScoutWatch WHERE id='old-watch'");
    const wish = { action: "wish", title: "Jordan 金签", playerName: "Player K", budget: "88.25", currency: "CNY", notes: "PSA 10" };
    const id = (await post(wish)).id;
    assert.equal((await get()).plans[0].budgetMinor, "8825");
    await post({ ...wish, id, budget: "0" });
    assert.equal((await get()).plans[0].budgetMinor, "0");
    for (const budget of ["1.234", "-1", "1e5"]) await post({ ...wish, id, budget }, 400);
    await post({ ...wish, id, watchIds: ["old-watch"] }, 400);
    for (const action of ["keyword-save", "wish-bind", "wish-state", "wish-undo", "keywords-delete"]) await post({ action, id, status: "acquired", cardIds: ["held"] }, 400);
    for (const query of ["references=1", "wishCards=" + id, "cards=Jordan"]) assert.equal((await fetch(base + "/api/scout?" + query)).status, 410);
    assert.equal((await fetch(base + "/api/scout/export?kind=wishes")).status, 404);
    assert.equal((await get("/api/scout?q=Jordan%20PSA%20%E9%87%91%E7%AD%BE")).count, 1);
    assert.equal((await get("/api/scout?q=player%20k")).count, 1);
    assert.equal((await get("/api/scout?q=notfound")).count, 0);
    for (let index = 0; index < 22; index++) await post({ action: "wish", title: "Page wish " + index, currency: "USD" });
    const next = await get("/api/scout?page=2"); assert.equal(next.count, 23); assert.equal(next.plans.length, 3);
    const cardCount = db.prepare("SELECT count(*) n FROM Card").get().n;
    for (const table of tables) assert.equal(db.prepare("SELECT count(*) n FROM " + table).get().n, 0);
    assert.equal(cardCount, 1);
    await post({ action: "wish-delete", id });
    assert.equal(db.prepare("SELECT count(*) n FROM CollectionPlan WHERE id=?").get(id).n, 0);
    assert.equal((await get()).count, 22);
    console.log("Simple Scout HTTP flow passed: existing data preserved, explicit deletion, independent wishes, exact budgets, bounded pages, Unicode search, retired APIs and no new card bindings.");
  } catch (error) { console.error(output.join("")); throw error; }
  finally { db?.close(); stopServer(server); await removeTempRoot(root); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
