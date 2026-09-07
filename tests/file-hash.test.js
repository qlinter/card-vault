const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { sha256File } = require("../lib/file-hash");

test("file checksum agrees with SHA-256 for empty, binary and multi-chunk files", t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "card-vault-hash-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const file = path.join(root, "sample.bin");
  for (const bytes of [Buffer.alloc(0), Buffer.from([0, 255, 10, 128]), Buffer.alloc(2 * 1024 * 1024 + 13, 173)]) {
    fs.writeFileSync(file, bytes);
    assert.equal(sha256File(file), createHash("sha256").update(bytes).digest("hex"));
  }
  assert.throws(() => sha256File(path.join(root, "missing")), { code: "ENOENT" });
});
