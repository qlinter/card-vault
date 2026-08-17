const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const markerName = ".card-vault-dependencies.sha256";

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function createFingerprintPayload(rootDir, runtime = {}) {
  const packageJson = readJson(path.join(rootDir, "package.json"));
  const scripts = packageJson.scripts || {};
  const payload = {
    runtime: `${runtime.platform || process.platform}-${runtime.architecture || process.arch}-node${String(runtime.nodeVersion || process.versions.node).split(".")[0]}`,
    dependencies: packageJson.dependencies || {},
    devDependencies: packageJson.devDependencies || {},
    optionalDependencies: packageJson.optionalDependencies || {},
    peerDependencies: packageJson.peerDependencies || {},
    overrides: packageJson.overrides || {},
    installScripts: {
      preinstall: scripts.preinstall || "",
      install: scripts.install || "",
      postinstall: scripts.postinstall || ""
    }
  };
  const lockPath = path.join(rootDir, "package-lock.json");
  if (fs.existsSync(lockPath)) {
    const packageLock = readJson(lockPath);
    payload.lockfileVersion = packageLock.lockfileVersion;
    payload.packages = Object.fromEntries(Object.entries(packageLock.packages || {}).filter(([packagePath]) => packagePath));
  }
  return payload;
}

function createDependencyFingerprint(rootDir, runtime) {
  const payload = createFingerprintPayload(rootDir, runtime);
  return crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

function markerPath(rootDir) {
  return path.join(rootDir, "node_modules", markerName);
}

function dependencyFingerprintMatches(rootDir, runtime) {
  const filePath = markerPath(rootDir);
  return fs.existsSync(filePath)
    && fs.readFileSync(filePath, "utf8").trim() === createDependencyFingerprint(rootDir, runtime);
}

function writeDependencyFingerprint(rootDir, runtime) {
  fs.writeFileSync(markerPath(rootDir), `${createDependencyFingerprint(rootDir, runtime)}\n`);
}

function runCli() {
  const command = process.argv[2];
  const rootDir = path.resolve(__dirname, "..");
  if (command === "check") process.exit(dependencyFingerprintMatches(rootDir) ? 0 : 1);
  if (command === "write") {
    writeDependencyFingerprint(rootDir);
    return;
  }
  process.stderr.write("Usage: node scripts/dependency-fingerprint.js <check|write>\n");
  process.exitCode = 2;
}

if (require.main === module) runCli();

module.exports = {
  createDependencyFingerprint,
  dependencyFingerprintMatches,
  writeDependencyFingerprint
};
