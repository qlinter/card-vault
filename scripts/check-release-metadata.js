const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

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

// A local build can succeed even when an overly broad ignore rule omits a route
// from clean checkouts. Only inspect source files, never collection directories.
if (fs.existsSync(path.join(rootDir, ".git"))) {
  const sourceFiles = ["app", "components", "lib", "electron", "prisma", "scripts"].flatMap(directory =>
    fs.readdirSync(path.join(rootDir, directory), { recursive: true })
      .filter(name => /\.(?:tsx?|[cm]?js|css|prisma)$/.test(name))
      .map(name => `${directory}/${name.replaceAll(path.sep, "/")}`)
  );
  const ignored = spawnSync("git", ["check-ignore", "--no-index", "--stdin"], {
    cwd: rootDir, input: sourceFiles.join("\n") + "\n", encoding: "utf8", windowsHide: true
  });
  if (ignored.error) throw ignored.error;
  assert.ok(ignored.status === 0 || ignored.status === 1, ignored.stderr || "Unable to inspect source ignore rules");
  assert.equal(ignored.stdout.trim(), "", `Source files must not be ignored:\n${ignored.stdout}`);
}
process.stdout.write(`Release metadata check passed for v${version}.\n`);
