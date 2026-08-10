const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const targets = [
  ".next/cache",
  "logs",
  "tsconfig.tsbuildinfo",
  "e2e-server.log",
  "e2e-server-error.log"
];

function removeTarget(relativePath) {
  const absolutePath = path.resolve(root, relativePath);

  if (!absolutePath.startsWith(root + path.sep) && absolutePath !== root) {
    throw new Error(`Refusing to remove path outside project: ${absolutePath}`);
  }

  if (!fs.existsSync(absolutePath)) {
    return false;
  }

  fs.rmSync(absolutePath, { recursive: true, force: true });
  return true;
}

let removed = 0;
for (const target of targets) {
  if (removeTarget(target)) {
    removed += 1;
    console.log(`Removed ${target}`);
  }
}

if (removed === 0) {
  console.log("No cache targets found.");
}
