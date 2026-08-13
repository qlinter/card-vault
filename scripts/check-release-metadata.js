const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const rootDir = path.resolve(__dirname, "..");
const packageJson = require(path.join(rootDir, "package.json"));
const packageLock = require(path.join(rootDir, "package-lock.json"));
const version = packageJson.version;

assert.match(version, /^\d+\.\d+\.\d+$/, "package.json version must use x.y.z format");
assert.equal(packageLock.version, version, "package-lock.json top-level version is stale");
assert.equal(packageLock.packages?.[""]?.version, version, "package-lock.json root package version is stale");
assert.equal(packageJson.engines?.node, ">=24 <25", "supported Node.js runtime must remain explicit");
assert.equal(fs.readFileSync(path.join(rootDir, ".nvmrc"), "utf8").trim(), "24", ".nvmrc must match the supported Node.js major");

for (const readmeName of ["README.md", "README.en.md"]) {
  const readme = fs.readFileSync(path.join(rootDir, readmeName), "utf8");
  assert.ok(readme.includes(`\`${version}\``), `${readmeName} does not identify v${version}`);
  assert.ok(readme.includes(`card-vault-${version}-setup.exe`), `${readmeName} installer filename is stale`);
  assert.ok(readme.includes(`card-vault-${version}-portable.zip`), `${readmeName} portable filename is stale`);
}

const releaseNotesPath = path.join(rootDir, "docs", `release-v${version}.md`);
assert.ok(fs.existsSync(releaseNotesPath), `missing release notes: ${releaseNotesPath}`);
process.stdout.write(`Release metadata check passed for v${version}.\n`);
