const fs = require("node:fs");
const path = require("node:path");
const sharp = require("sharp");

const homeThumbnailSuffix = ".home.webp";
const homeThumbnailMaxEdge = 640;

function sourceFileName(imagePath) {
  return path.basename(String(imagePath || "").trim());
}

function homeThumbnailFileName(imagePath) {
  const fileName = sourceFileName(imagePath);
  return fileName ? `${fileName}${homeThumbnailSuffix}` : "";
}

function sourceFileNameFromHomeThumbnail(thumbnailName) {
  const safeName = path.basename(String(thumbnailName || "").trim());
  if (!safeName.endsWith(homeThumbnailSuffix)) return null;
  const fileName = safeName.slice(0, -homeThumbnailSuffix.length);
  return fileName && fileName === path.basename(fileName) ? fileName : null;
}

function homeThumbnailPublicPath(imagePath) {
  const fileName = homeThumbnailFileName(imagePath);
  return fileName ? `/thumbnails/${encodeURIComponent(fileName)}` : "";
}

async function hasFreshThumbnail(sourcePath, targetPath) {
  try {
    const [sourceStat, targetStat] = await Promise.all([fs.promises.stat(sourcePath), fs.promises.stat(targetPath)]);
    return targetStat.size > 0 && targetStat.mtimeMs >= sourceStat.mtimeMs;
  } catch {
    return false;
  }
}

async function removeFileWithRetry(filePath) {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      await fs.promises.rm(filePath, { force: true });
      return;
    } catch (error) {
      if (!error || !["EBUSY", "EPERM"].includes(error.code) || attempt === 5) throw error;
      await new Promise((resolve) => setTimeout(resolve, 25 * (attempt + 1)));
    }
  }
}

async function ensureHomeThumbnail(sourcePath, targetPath) {
  if (await hasFreshThumbnail(sourcePath, targetPath)) return { status: "cached", path: targetPath };

  await fs.promises.mkdir(path.dirname(targetPath), { recursive: true });
  const temporaryPath = `${targetPath}.tmp-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  try {
    await sharp(sourcePath)
      .rotate()
      .resize({
        width: homeThumbnailMaxEdge,
        height: homeThumbnailMaxEdge,
        fit: "inside",
        withoutEnlargement: true
      })
      .webp({ quality: 82, effort: 4 })
      .toFile(temporaryPath);
    await removeFileWithRetry(targetPath);
    await fs.promises.rename(temporaryPath, targetPath);
    return { status: "generated", path: targetPath };
  } finally {
    await removeFileWithRetry(temporaryPath).catch(() => {});
  }
}

async function removeHomeThumbnail(thumbnailsDir, imagePath) {
  const fileName = homeThumbnailFileName(imagePath);
  if (!fileName) return;
  await removeFileWithRetry(path.join(thumbnailsDir, fileName));
}

module.exports = {
  ensureHomeThumbnail,
  homeThumbnailFileName,
  homeThumbnailMaxEdge,
  homeThumbnailPublicPath,
  removeHomeThumbnail,
  sourceFileNameFromHomeThumbnail
};
