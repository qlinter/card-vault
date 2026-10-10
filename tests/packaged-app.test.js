const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { verifyPackagedApplication } = require("../scripts/packaged-app");

test("packaged application checks reject stale builds, missing runtime files and development content", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "card-vault-packaged-check-"));
  const appRoot = path.join(root, "resources", "app");
  function write(file, content) { const target = path.join(root, file); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, content); }
  try {
    write("Card Vault.exe", "fixture");
    write("resources/app/package.json", JSON.stringify({ version: "1.3.6" }));
    write("resources/app/.next/BUILD_ID", "current-build");
    write("resources/app/node_modules/.prisma/client/schema.prisma", "model ShareSection { presentationConfig String }");
    write("resources/app/node_modules/@swc/helpers/package.json", "{}");
    write("resources/app/node_modules/next/dist/bin/next", "runtime");
    assert.equal(verifyPackagedApplication(root, "1.3.6", { buildId: "current-build" }), path.join(root, "Card Vault.exe"));
    assert.throws(() => verifyPackagedApplication(root, "1.3.5"), /version is stale/);
    assert.throws(() => verifyPackagedApplication(root, "1.3.6", { buildId: "old-build" }), /build is stale/);
    write("resources/app/scripts/test-live-ai.js", "fixture");
    assert.throws(() => verifyPackagedApplication(root, "1.3.6"), /forbidden generated files/);
    fs.rmSync(path.join(appRoot, "scripts", "test-live-ai.js"));
    fs.rmSync(path.join(appRoot, "node_modules", "next", "dist", "bin", "next"));
    assert.throws(() => verifyPackagedApplication(root, "1.3.6"), /is missing/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
