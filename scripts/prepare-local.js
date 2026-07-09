const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { resolveShareCoversDir, resolveUploadsDir } = require("./storage-paths");

const rootDir = path.resolve(__dirname, "..");
const envExamplePath = path.join(rootDir, ".env.example");
const envPath = path.join(rootDir, ".env");
const uploadsDir = resolveUploadsDir(rootDir);
const shareCoversDir = resolveShareCoversDir(rootDir);
const nextDir = path.join(rootDir, ".next");

function runCommand(label, command, args) {
  return new Promise((resolve, reject) => {
    process.stdout.write(`${label}\n`);

    const child = spawn("cmd.exe", ["/c", command, ...args], {
      cwd: rootDir,
      stdio: "inherit"
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} ${args.join(" ")} exited with code ${code ?? "unknown"}.`));
    });
  });
}

async function main() {
  if (!fs.existsSync(envPath) && fs.existsSync(envExamplePath)) {
    fs.copyFileSync(envExamplePath, envPath);
    process.stdout.write("[1/5] Created local .env file.\n");
  } else {
    process.stdout.write("[1/5] .env file already exists.\n");
  }

  fs.mkdirSync(uploadsDir, { recursive: true });
  fs.mkdirSync(shareCoversDir, { recursive: true });
  process.stdout.write("[2/5] App data directory is ready.\n");

  if (fs.existsSync(nextDir)) {
    fs.rmSync(nextDir, { recursive: true, force: true });
    process.stdout.write("[prep] Removed old build cache.\n");
  }

  await runCommand("[3/5] Generating Prisma client...", "npm.cmd", ["run", "prisma:generate"]);
  await runCommand("[4/5] Initializing local database...", "node", ["scripts/init-db.js"]);
  await runCommand("[5/5] Building app...", "npm.cmd", ["run", "build"]);

  if (!fs.existsSync(path.join(nextDir, "BUILD_ID"))) {
    throw new Error("Build completed but .next/BUILD_ID was not created.");
  }
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
});
