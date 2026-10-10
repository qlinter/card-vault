const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { assertPackagedTreeClean } = require("./release-bundle-hygiene");

function verifyPackagedApplication(unpackedDir, version, { buildId } = {}) {
  const appRoot = path.join(unpackedDir, "resources", "app");
  const executable = path.join(unpackedDir, "Card Vault.exe");
  const packagePath = path.join(appRoot, "package.json");
  const schemaPath = path.join(appRoot, "node_modules", ".prisma", "client", "schema.prisma");
  const buildPath = path.join(appRoot, ".next", "BUILD_ID");
  for (const required of [executable, packagePath, schemaPath, buildPath,
    path.join(appRoot, "node_modules", "@swc", "helpers", "package.json"),
    path.join(appRoot, "node_modules", "next", "dist", "bin", "next")]) {
    assert.ok(fs.existsSync(required), `Packaged application is missing: ${required}`);
  }
  assert.equal(JSON.parse(fs.readFileSync(packagePath, "utf8")).version, version, "Packaged application version is stale.");
  const schema = fs.readFileSync(schemaPath, "utf8");
  assert.ok(schema.includes("model ShareSection") && schema.includes("presentationConfig"), "Packaged Prisma Client schema is stale.");
  if (buildId !== undefined) assert.equal(fs.readFileSync(buildPath, "utf8").trim(), buildId.trim(), "Packaged application build is stale.");
  assertPackagedTreeClean(appRoot);
  return executable;
}

module.exports = { verifyPackagedApplication };
