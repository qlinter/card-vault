const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const sharp = require("sharp");
const { initializeDatabase } = require("../scripts/database-schema");
const { studioFilename } = require("../lib/studio-file");
const { inspectStudioHealth } = require("../electron/storage/studio-health");

test("studio health distinguishes current intact, truncated, missing and historical images", async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "cv-studio-health-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const database = path.join(root, "dev.db"), studio = path.join(root, "studio-images");
  initializeDatabase(database); fs.mkdirSync(studio);
  const db = new DatabaseSync(database);
  const bytes = await sharp({ create: { width: 64, height: 64, channels: 3, background: "blue" } }).png().toBuffer();
  try {
    for (const id of ["ready", "missing", "damaged"]) {
      db.prepare("INSERT INTO Card(id,playerName,cardTitle,sport) VALUES(?,?,?,'Football')").run(id,id,id);
      const image = { id, path: "/media/" + id + ".png", rotation: 0 };
      db.prepare("INSERT INTO CardImage(id,cardId,path) VALUES(?,?,?)").run(id,id,image.path);
      const name = studioFilename({ id, cardTitle:id, images:[image] });
      if (id !== "missing") fs.writeFileSync(path.join(studio,name), id === "ready" ? bytes : bytes.subarray(0,55));
    }
  } finally { db.close(); }
  fs.writeFileSync(path.join(studio,"old.png"),bytes);
  const result = await inspectStudioHealth(root);
  assert.equal(result.ready,1);
  assert.deepEqual(result.missing.map(c => c.id),["missing"]);
  assert.deepEqual(result.damaged.map(c => c.id),["damaged"]);
  assert.deepEqual(result.historical,["old.png"]);
  assert.deepEqual(fs.readFileSync(path.join(studio,"old.png")),bytes);
});
