const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { DatabaseSync } = require("node:sqlite");
const { initializeDatabase } = require("../scripts/database-schema");
const { writeBackupManifest } = require("../electron/storage/backup-manifest");
const { ensureDataLayout } = require("../electron/storage/layout");
const { journalPath } = require("../electron/storage/restore-journal");
const test = require("node:test");

const lockedPoints = process.platform === "win32" ? ["locked-original-entry", "locked-incoming-entry", "locked-success", "locked-cleanup"] : [];
for (const point of ["original-renamed", "incoming-renamed", "verified", ...lockedPoints]) test(`restore with interruption or locked root: ${point}`, t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "card-vault-interruption-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const name of ["current", "incoming"]) {
    const folder = path.join(root, name); initializeDatabase(path.join(folder, "dev.db"));
    const db = new DatabaseSync(path.join(folder, "dev.db")); db.prepare("INSERT INTO Card(id,playerName,cardTitle,sport) VALUES(?,?,?,'Basketball')").run(name, name, name); db.close();
    fs.writeFileSync(path.join(folder, "marker.txt"), name);
  }
  writeBackupManifest(path.join(root, "incoming"));
  const script = `
    const fs = require('node:fs'), path = require('node:path');
    const root = process.argv[1], point = process.argv[2], target = path.join(root,'current');
    const {createRestoreService} = require('./electron/storage/restore');
    const {ensureDataLayout} = require('./electron/storage/layout');
    // Windows holds a process's working directory open without delete sharing.
    if (point.startsWith('locked-')) process.chdir(target);
    const rename = fs.renameSync;
    fs.renameSync = (from,to) => {
      rename(from,to);
      if (point === 'locked-original-entry' && path.dirname(from) === target) process.exit(73);
      if (point === 'locked-incoming-entry' && path.dirname(to) === target) process.exit(73);
      if (point === 'original-renamed' && from === target) process.exit(73);
      if (point === 'incoming-renamed' && to === target) process.exit(73);
      if (point === 'verified' && String(to).endsWith('-restore-journal.json') && JSON.parse(fs.readFileSync(to)).stage === 'verified') process.exit(73);
    };
    if (point === 'locked-cleanup') {
      const original = fs.rmdirSync;
      fs.rmdirSync = (dir,...args) => { if (String(dir).includes('restore-staging')) throw Error('locked staging'); return original(dir,...args); };
    }
    const result = createRestoreService({config:{getDataDir:()=>target,getDbPath:()=>path.join(target,'dev.db'),getBackupDir:()=>path.join(root,'backups')},backupDataFolder:()=>({backupPath:'fixture-safety'}),ensureDataLayout}).restoreDataFolder(path.join(root,'incoming'));
    if (point === 'locked-cleanup' && result.retainedPaths.length !== 1) process.exit(12);
  `;
  const result = spawnSync(process.execPath, ["-e", script, root, point], { cwd: path.resolve(__dirname, ".."), windowsHide: true, encoding: "utf8", timeout: 15000 });
  if (point === "locked-success" || point === "locked-cleanup") {
    assert.equal(result.status, 0, result.stderr);
    const target = path.join(root, "current");
    assert.equal(fs.readFileSync(path.join(target, "marker.txt"), "utf8"), "incoming");
    assert.equal(fs.existsSync(journalPath(target)), false);
    assert.equal(fs.readdirSync(root).some(name => name.includes("-restore-")), point === "locked-cleanup");
    return;
  }
  assert.equal(result.status, 73, result.stderr);
  const target = path.join(root, "current"); assert.ok(fs.existsSync(journalPath(target)));
  const recovery = ensureDataLayout(target);
  assert.equal(recovery.keptVerifiedRestore, point === "verified");
  assert.equal(fs.readFileSync(path.join(target, "marker.txt"), "utf8"), point === "verified" ? "incoming" : "current");
  const db = new DatabaseSync(path.join(target, "dev.db"), { readOnly: true });
  assert.equal(db.prepare("SELECT id FROM Card").get().id, point === "verified" ? "incoming" : "current"); db.close();
  assert.ok(!fs.existsSync(journalPath(target)));
  assert.equal(ensureDataLayout(target), null);
});

test("untrusted restore journals cannot rename or delete paths outside the data parent", t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "card-vault-journal-guard-")); t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const target = path.join(root, "data");
  fs.writeFileSync(journalPath(target), JSON.stringify({ version: 1, target, suffix: "1-2", stage: "verified", staging: os.tmpdir(), rollback: root }));
  assert.throws(() => ensureDataLayout(target), /路径无效/);
  assert.ok(fs.existsSync(journalPath(target))); assert.ok(!fs.existsSync(target));
});
