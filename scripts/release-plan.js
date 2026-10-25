const fs = require("node:fs"), path = require("node:path");
const { spawnSync } = require("node:child_process");
const { sha256File } = require("../lib/file-hash");
const { createHash } = require("node:crypto");

function releasePlan(args) {
  const allowed = new Set(["--package-only", "--plan"]);
  for (const arg of args) if (!allowed.has(arg)) throw new Error(`Unknown release option: ${arg}`);
  const packageOnly = args.includes("--package-only");
  return { mode: packageOnly ? "package-only" : "full", checks: packageOnly ? "skipped" : "required", build: "required", runtimeTests: packageOnly ? "skipped" : "required", artifactVerification: "required" };
}

function verifyInstalledDependencies(root) {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  const lock = JSON.parse(fs.readFileSync(path.join(root, "package-lock.json"), "utf8"));
  const versions = {};
  for (const name of Object.keys({ ...pkg.dependencies, ...pkg.devDependencies })) {
    const expected = lock.packages[`node_modules/${name}`]?.version;
    const installedPath = path.join(root, "node_modules", name, "package.json");
    const actual = fs.existsSync(installedPath) ? JSON.parse(fs.readFileSync(installedPath, "utf8")).version : null;
    if (!expected || actual !== expected) throw new Error(`Installed ${name} ${actual || "missing"} differs from lockfile ${expected || "missing"}. Run npm ci before packaging.`);
    versions[name] = actual;
  }
  return versions;
}

function sourceIdentity(root) {
  const git = args => spawnSync("git", args, { cwd: root, encoding: "utf8", windowsHide: true });
  const head = git(["rev-parse", "HEAD"]), status = git(["status", "--porcelain", "--untracked-files=normal"]);
  const listing = git(["ls-files", "-z", "--cached", "--others", "--exclude-standard", "--", "app", "components", "electron", "lib", "scripts", "prisma", "public", "build/icon.ico", "next.config.mjs", "package.json", "package-lock.json"]);
  const files = listing.status === 0 ? [...new Set(listing.stdout.split("\0").filter(Boolean))].filter(name => fs.existsSync(path.join(root, name)) && fs.statSync(path.join(root, name)).isFile()).sort() : [];
  const hash = createHash("sha256");
  for (const name of files) hash.update(name + "\0" + sha256File(path.join(root, name)) + "\n");
  return { commit: head.status === 0 ? head.stdout.trim() : null, dirty: status.status === 0 ? Boolean(status.stdout.trim()) : null, treeSha256: files.length ? hash.digest("hex") : null, fileCount: files.length };
}

function releaseManifest(root, plan, versions, { signingMode, artifacts }) {
  return { formatVersion: 1, createdAt: new Date().toISOString(), appVersion: JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")).version,
    source: sourceIdentity(root), lockfileSha256: sha256File(path.join(root, "package-lock.json")), buildId: fs.readFileSync(path.join(root, ".next", "BUILD_ID"), "utf8").trim(),
    node: process.version, dependencyVersions: versions, mode: plan.mode, signingMode,
    validation: { sourceChecks: plan.checks === "required" ? "passed" : "skipped", productionBuild: "passed", packagedRuntimeTests: plan.runtimeTests === "required" ? "passed" : "skipped", artifactVerification: "passed" }, artifacts };
}

module.exports = { releasePlan, verifyInstalledDependencies, releaseManifest };
