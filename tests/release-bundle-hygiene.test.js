const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const {
  assertArtifactSize,
  assertPackagedTreeClean,
  isForbiddenPackagedEntry,
  prunePrismaTempEngines
} = require("../scripts/release-bundle-hygiene");

test("release bundle rejects Prisma temporary engines and source maps", () => {
  assert.equal(isForbiddenPackagedEntry("resources/app/node_modules/.prisma/client/query_engine.dll.node.tmp123"), true);
  assert.equal(isForbiddenPackagedEntry("resources/app/node_modules/next/runtime.js.map"), true);
  assert.equal(isForbiddenPackagedEntry("resources/app/node_modules/.prisma/client/query_engine.dll.node"), false);
  assert.equal(isForbiddenPackagedEntry("LICENSES.chromium.html"), false);
});

test("release cleanup removes only Prisma temporary engines", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "card-vault-release-hygiene-"));
  try {
    const engine = path.join(root, "query_engine-windows.dll.node");
    const temporary = `${engine}.tmp123`;
    const sourceMap = path.join(root, "runtime.js.map");
    fs.writeFileSync(engine, "engine");
    fs.writeFileSync(temporary, "temporary");
    fs.writeFileSync(sourceMap, "map");
    assert.deepEqual(prunePrismaTempEngines(root), [temporary]);
    assert.equal(fs.existsSync(engine), true);
    assert.equal(fs.existsSync(temporary), false);
    assert.equal(fs.existsSync(sourceMap), true);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("release tree and artifact budgets fail closed", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "card-vault-release-tree-"));
  try {
    fs.mkdirSync(path.join(root, "node_modules", "next"), { recursive: true });
    const mapPath = path.join(root, "node_modules", "next", "runtime.js.map");
    fs.writeFileSync(mapPath, "map");
    assert.throws(() => assertPackagedTreeClean(root), /forbidden generated files/);
    fs.rmSync(mapPath, { force: true });
    assert.doesNotThrow(() => assertPackagedTreeClean(root));
    const artifact = path.join(root, "artifact.bin");
    fs.writeFileSync(artifact, Buffer.alloc(8));
    assert.equal(assertArtifactSize(artifact, 8, "artifact"), 8);
    assert.throws(() => assertArtifactSize(artifact, 7, "artifact"), /release budget/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
