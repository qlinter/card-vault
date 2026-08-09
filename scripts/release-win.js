const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const rootDir = path.resolve(__dirname, "..");
const packageJson = require(path.join(rootDir, "package.json"));
const distDir = path.join(rootDir, "dist");
const setupPath = path.join(distDir, `card-vault-${packageJson.version}-setup.exe`);
const zipPath = path.join(distDir, `card-vault-${packageJson.version}-portable.zip`);
const unpackedDir = path.join(distDir, "win-unpacked");

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

function verifyPackagedFiles() {
  const appRoot = path.join(unpackedDir, "resources", "app");
  const packagedPackagePath = path.join(appRoot, "package.json");
  const prismaSchemaPath = path.join(appRoot, "node_modules", ".prisma", "client", "schema.prisma");
  const buildIdPath = path.join(appRoot, ".next", "BUILD_ID");
  const executablePath = path.join(unpackedDir, "Card Vault.exe");
  for (const requiredPath of [packagedPackagePath, prismaSchemaPath, buildIdPath, executablePath, setupPath]) {
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

function powershellLiteral(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function createPortableZip() {
  const command = [
    "$ErrorActionPreference = 'Stop'",
    `Compress-Archive -Path ${powershellLiteral(path.join(unpackedDir, "*"))} -DestinationPath ${powershellLiteral(zipPath)} -CompressionLevel Optimal`
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

  cleanDistDirectory();
  run("npm.cmd", ["run", "check:release"]);
  run("npm.cmd", ["run", "package:win"]);
  const executablePath = verifyPackagedFiles();
  smokeTestPackagedRuntime(executablePath);
  removeArtifact(path.join(unpackedDir, "resources", "app", "logs"));
  createPortableZip();

  const [setupHash, zipHash] = await Promise.all([hashFile(setupPath), hashFile(zipPath)]);
  removeArtifact(unpackedDir);
  removeArtifact(`${setupPath}.blockmap`);
  removeArtifact(path.join(distDir, "latest.yml"));
  removeArtifact(path.join(distDir, "builder-debug.yml"));
  removeArtifact(path.join(distDir, "builder-effective-config.yaml"));

  process.stdout.write("\nWindows release completed.\n");
  process.stdout.write(`${path.basename(setupPath)}  SHA256 ${setupHash}\n`);
  process.stdout.write(`${path.basename(zipPath)}  SHA256 ${zipHash}\n`);
}

main().catch((error) => {
  process.stderr.write(`\nRelease failed: ${error instanceof Error ? error.message : error}\n`);
  process.exitCode = 1;
});
