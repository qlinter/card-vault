import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ensureHistoryReady } from "../lib/history-readiness.ts";

test("history guard reuses completed versions, retries failures and invalidates replaced databases", t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "vault-ready-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const file = path.join(root, "dev.db");
  fs.writeFileSync(file, "database");
  let calls = 0;
  const reset = () => { calls++; return { changed: true, counts: {}, backupPath: null }; };
  assert.equal(ensureHistoryReady(file, 1, reset).changed, true);
  assert.equal(ensureHistoryReady(file, 1, reset).changed, false);
  assert.equal(ensureHistoryReady(file, 2, reset).changed, true);
  assert.equal(ensureHistoryReady(file, 1, reset).changed, false);
  assert.equal(calls, 2);
  fs.renameSync(file, path.join(root, "old.db"));
  fs.writeFileSync(file, "restored");
  assert.throws(() => ensureHistoryReady(file, 2, () => { throw new Error("busy"); }), /busy/);
  assert.equal(ensureHistoryReady(file, 2, reset).changed, true);
  assert.equal(calls, 3);
});
