const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { resolveWindowsSigning } = require("./windows-signing");

const rootDir = path.resolve(__dirname, "..");
const packageJson = require(path.join(rootDir, "package.json"));
const distDir = path.join(rootDir, "dist");
const setupPath = path.join(distDir, `card-vault-${packageJson.version}-setup.exe`);
const zipPath = path.join(distDir, `card-vault-${packageJson.version}-portable.zip`);
const unpackedDir = path.join(distDir, "win-unpacked");
const checksumPath = path.join(distDir, "SHA256SUMS.txt");
const legacyNsisDirName = "nsis-3.0.4.1-nsis-3.0.4.1";
const legacyNsisResourcesDirName = "nsis-resources-3.4.1-nsis-resources-3.4.1";

function run(command, args, options = {}) {
  process.stdout.write(`\n> ${command} ${args.join(" ")}\n`);
  const isWindowsCommandScript = process.platform === "win32" && /\.(cmd|bat)$/i.test(command);
  const executable = isWindowsCommandScript ? (process.env.ComSpec || "cmd.exe") : command;
  const executableArgs = isWindowsCommandScript ? ["/d", "/s", "/c", command, ...args] : args;
  const result = spawnSync(executable, executableArgs, {
    cwd: rootDir,
    env: { ...process.env, ...options.env },
    stdio: "inherit",
    windowsHide: true,
    timeout: options.timeout
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`${command} exited with code ${result.status ?? "unknown"}.`);
  }
}

function assertInsideDist(targetPath) {
  const resolved = path.resolve(targetPath);
  if (resolved !== distDir && !resolved.startsWith(distDir + path.sep)) {
    throw new Error(`Refusing to modify a path outside dist: ${resolved}`);
  }
  return resolved;
}

function removeArtifact(targetPath) {
  const resolved = assertInsideDist(targetPath);
  if (fs.existsSync(resolved)) {
    fs.rmSync(resolved, { recursive: true, force: true });
  }
}

function cleanDistDirectory() {
  if (fs.existsSync(distDir)) {
    for (const entry of fs.readdirSync(distDir)) {
      removeArtifact(path.join(distDir, entry));
    }
  }
  fs.mkdirSync(distDir, { recursive: true });
}

function resolveBundledNsisToolEnv() {
  const env = {};
  const cacheRoot = process.env.ELECTRON_BUILDER_CACHE || path.join(process.env.LOCALAPPDATA || "", "electron-builder", "Cache");
  const nsisCacheRoot = path.join(cacheRoot, "nsis");
  const nsisDir = path.join(nsisCacheRoot, legacyNsisDirName);
  const nsisResourcesDir = path.join(nsisCacheRoot, legacyNsisResourcesDirName);

  if (process.env.ELECTRON_BUILDER_NSIS_DIR == null && fs.existsSync(path.join(nsisDir, "Bin", "makensis.exe"))) {
    env.ELECTRON_BUILDER_NSIS_DIR = nsisDir;
  }

  if (
    process.env.ELECTRON_BUILDER_NSIS_RESOURCES_DIR == null &&
    fs.existsSync(path.join(nsisResourcesDir, "plugins"))
  ) {
    env.ELECTRON_BUILDER_NSIS_RESOURCES_DIR = nsisResourcesDir;
  }

  return env;
}

function verifyPackagedFiles() {
  const appRoot = path.join(unpackedDir, "resources", "app");
  const packagedPackagePath = path.join(appRoot, "package.json");
  const prismaSchemaPath = path.join(appRoot, "node_modules", ".prisma", "client", "schema.prisma");
  const swcHelpersPath = path.join(appRoot, "node_modules", "@swc", "helpers", "package.json");
  const buildIdPath = path.join(appRoot, ".next", "BUILD_ID");
  const executablePath = path.join(unpackedDir, "Card Vault.exe");
  for (const requiredPath of [packagedPackagePath, prismaSchemaPath, swcHelpersPath, buildIdPath, executablePath, setupPath]) {
    if (!fs.existsSync(requiredPath)) {
      throw new Error(`Packaged release is missing: ${requiredPath}`);
    }
  }

  const packagedPackage = JSON.parse(fs.readFileSync(packagedPackagePath, "utf8"));
  const prismaSchema = fs.readFileSync(prismaSchemaPath, "utf8");
  if (packagedPackage.version !== packageJson.version) {
    throw new Error(`Packaged version ${packagedPackage.version} does not match ${packageJson.version}.`);
  }
  if (!prismaSchema.includes("model ShareSection") || !prismaSchema.includes("presentationConfig")) {
    throw new Error("Packaged Prisma Client does not contain the current share collection schema.");
  }
  return executablePath;
}

function smokeTestPackagedRuntime(executablePath) {
  const packagedScriptsDir = path.join(unpackedDir, "resources", "app", "scripts");
  for (const scriptName of ["test-card-flow.js", "test-share-flow.js"]) {
    run(executablePath, [path.join(packagedScriptsDir, scriptName)], {
      timeout: 120000,
      env: { ELECTRON_RUN_AS_NODE: "1" }
    });
  }
}

function verifyPackagedHealthEndpoint(executablePath) {
  const smokeScriptPath = path.join(rootDir, "scripts", "test-packaged-runtime.js");
  run(executablePath, [smokeScriptPath, unpackedDir], {
    timeout: 120000,
    env: { ELECTRON_RUN_AS_NODE: "1" }
  });
}

function powershellLiteral(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function createPortableZip() {
  const command = [
    "$ErrorActionPreference = 'Stop'",
    "Add-Type -AssemblyName System.IO.Compression.FileSystem",
    `if (Test-Path -LiteralPath ${powershellLiteral(zipPath)}) { Remove-Item -LiteralPath ${powershellLiteral(zipPath)} -Force }`,
    `[System.IO.Compression.ZipFile]::CreateFromDirectory(${powershellLiteral(unpackedDir)}, ${powershellLiteral(zipPath)}, [System.IO.Compression.CompressionLevel]::Optimal, $false)`
  ].join("; ");
  run("powershell.exe", ["-NoProfile", "-Command", command]);
  if (!fs.existsSync(zipPath) || fs.statSync(zipPath).size === 0) {
    throw new Error("Portable ZIP was not created.");
  }
}

function hashFile(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256");
    const stream = fs.createReadStream(filePath);
    stream.on("error", reject);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex").toUpperCase()));
  });
}

async function main() {
  if (process.platform !== "win32") {
    throw new Error("Windows release packaging must run on Windows.");
  }

  const signing = resolveWindowsSigning(process.env);
  process.stdout.write(`Windows signing mode: ${signing.description}\n`);

  cleanDistDirectory();
  run("npm.cmd", ["run", "check:release"]);
  run("node", ["scripts/patch-electron-builder-nsis.js"]);
  run("npm.cmd", ["run", "package:win"], { env: resolveBundledNsisToolEnv() });
  const executablePath = verifyPackagedFiles();
  smokeTestPackagedRuntime(executablePath);
  verifyPackagedHealthEndpoint(executablePath);
  removeArtifact(path.join(unpackedDir, "resources", "app", "logs"));
  createPortableZip();

  const [setupHash, zipHash] = await Promise.all([hashFile(setupPath), hashFile(zipPath)]);
  fs.writeFileSync(checksumPath, `${setupHash}  ${path.basename(setupPath)}\n${zipHash}  ${path.basename(zipPath)}\n`, "utf8");
  removeArtifact(unpackedDir);
  removeArtifact(`${setupPath}.blockmap`);
  removeArtifact(path.join(distDir, "latest.yml"));
  removeArtifact(path.join(distDir, "builder-debug.yml"));
  removeArtifact(path.join(distDir, "builder-effective-config.yaml"));
  run("node", ["scripts/verify-release-artifacts.js"]);

  process.stdout.write("\nWindows release completed.\n");
  process.stdout.write(`${path.basename(setupPath)}  SHA256 ${setupHash}\n`);
  process.stdout.write(`${path.basename(zipPath)}  SHA256 ${zipHash}\n`);
  process.stdout.write(`${path.basename(checksumPath)} written.\n`);
}

main().catch((error) => {
  process.stderr.write(`\nRelease failed: ${error instanceof Error ? error.message : error}\n`);
  process.exitCode = 1;
});
