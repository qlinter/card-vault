const fs = require("node:fs");
const path = require("node:path");
const pngToIcoModule = require("png-to-ico");
const sharp = require("sharp");

const pngToIco = pngToIcoModule.default || pngToIcoModule;

const rootDir = path.resolve(__dirname, "..");
const buildDir = path.join(rootDir, "build");
const normalizedPath = path.join(buildDir, "icon.normalized.png");
const targetPath = path.join(buildDir, "icon.ico");

function findSourceIcon() {
  const directPath = path.join(buildDir, "icon.png");
  if (fs.existsSync(directPath)) {
    return directPath;
  }

  const pngFiles = fs
    .readdirSync(buildDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".png"))
    .map((entry) => path.join(buildDir, entry.name));

  if (pngFiles.length === 0) {
    throw new Error(`No PNG icon source found in ${buildDir}`);
  }

  return pngFiles[0];
}

async function main() {
  const sourcePath = findSourceIcon();

  await sharp(sourcePath)
    .resize(1024, 1024, {
      fit: "cover",
      position: "centre"
    })
    .png()
    .toFile(normalizedPath);

  const buffer = await pngToIco(normalizedPath);
  fs.writeFileSync(targetPath, buffer);
  process.stdout.write(`Icon created: ${targetPath}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
});
