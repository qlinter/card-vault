const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const test = require("node:test");

test("cache cleanup preserves studio media, logs, and the usable production build", t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "card-vault-clean-cache-"));
  t.after(() => fs.rmSync(root, {recursive: true, force: true}));
  const script = path.join(root, "scripts", "clean-cache.js");
  fs.mkdirSync(path.dirname(script));
  fs.copyFileSync(path.join(__dirname, "../scripts/clean-cache.js"), script);
  const keep = ["logs/studio-retouched/12.png", "logs/playwright/version", "data/dev.db", "backups/snapshot", "dist/bundle.zip", ".next/BUILD_ID"];
  const remove = [".next/cache/entry", "playwright-report/index.html", "test-results/output", "tests/.ui-test-runtime/data/dev.db", "tests/.ui-test-runtime/auth-state.json", "tsconfig.tsbuildinfo"];
  for (const file of [...keep, ...remove]) {
    const target = path.join(root, file);
    fs.mkdirSync(path.dirname(target), {recursive: true});
    fs.writeFileSync(target, "fixture");
  }
  execFileSync(process.execPath, [script], {cwd: root});
  for (const file of keep) assert.equal(fs.readFileSync(path.join(root, file), "utf8"), "fixture");
  for (const file of remove) assert.equal(fs.existsSync(path.join(root, file)), false);
});
