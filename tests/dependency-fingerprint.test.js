const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {
  createDependencyFingerprint,
  dependencyFingerprintMatches,
  writeDependencyFingerprint
} = require("../scripts/dependency-fingerprint");

const runtime = { platform: "win32", architecture: "x64", nodeVersion: "24.7.0" };

function createFixture() {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "card-vault-dependencies-"));
  fs.mkdirSync(path.join(rootDir, "node_modules"));
  fs.writeFileSync(path.join(rootDir, "package.json"), JSON.stringify({
    name: "fixture",
    version: "1.0.17",
    scripts: { postinstall: "tool generate" },
    dependencies: { example: "1.0.0" }
  }));
  fs.writeFileSync(path.join(rootDir, "package-lock.json"), JSON.stringify({
    lockfileVersion: 3,
    packages: {
      "": { name: "fixture", version: "1.0.17", dependencies: { example: "1.0.0" } },
      "node_modules/example": { version: "1.0.0" }
    }
  }));
  return rootDir;
}

test("dependency fingerprint can be written and checked without reacting to an app-only version bump", (context) => {
  const rootDir = createFixture();
  context.after(() => fs.rmSync(rootDir, { recursive: true, force: true }));

  writeDependencyFingerprint(rootDir, runtime);
  assert.equal(dependencyFingerprintMatches(rootDir, runtime), true);

  const packageJsonPath = path.join(rootDir, "package.json");
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
  packageJson.version = "1.0.18";
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson));
  assert.equal(dependencyFingerprintMatches(rootDir, runtime), true);
});

test("dependency fingerprint changes when installed package metadata changes", (context) => {
  const rootDir = createFixture();
  context.after(() => fs.rmSync(rootDir, { recursive: true, force: true }));
  const original = createDependencyFingerprint(rootDir, runtime);

  const lockPath = path.join(rootDir, "package-lock.json");
  const packageLock = JSON.parse(fs.readFileSync(lockPath, "utf8"));
  packageLock.packages["node_modules/example"].version = "2.0.0";
  fs.writeFileSync(lockPath, JSON.stringify(packageLock));

  assert.notEqual(createDependencyFingerprint(rootDir, runtime), original);
});
