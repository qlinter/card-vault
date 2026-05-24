const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

function findRcedit() {
  const cacheRoot = path.join(
    process.env.LOCALAPPDATA || "",
    "electron-builder",
    "Cache",
    "winCodeSign"
  );

  if (!fs.existsSync(cacheRoot)) {
    throw new Error(`winCodeSign cache not found: ${cacheRoot}`);
  }

  const candidates = fs
    .readdirSync(cacheRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(cacheRoot, entry.name, "rcedit-x64.exe"))
    .filter((filePath) => fs.existsSync(filePath));

  if (candidates.length === 0) {
    throw new Error(`rcedit-x64.exe not found under: ${cacheRoot}`);
  }

  candidates.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
  return candidates[0];
}

module.exports = async function patchExeIcon(context) {
  if (process.platform !== "win32") {
    return;
  }

  const appOutDir = context.appOutDir;
  const productFilename = context.packager.appInfo.productFilename;
  const exePath = path.join(appOutDir, `${productFilename}.exe`);
  const iconPath = path.join(context.packager.info.projectDir, "build", "icon.ico");
  const rceditPath = findRcedit();

  if (!fs.existsSync(exePath)) {
    throw new Error(`Packaged exe not found: ${exePath}`);
  }

  if (!fs.existsSync(iconPath)) {
    throw new Error(`Icon file not found: ${iconPath}`);
  }

  execFileSync(rceditPath, [exePath, "--set-icon", iconPath], {
    stdio: "inherit"
  });
};
