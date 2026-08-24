const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const {
  ensureHomeThumbnail,
  homeThumbnailFileName
} = require("../lib/card-thumbnail-core.js");
const {
  resolveDbPath,
  resolveThumbnailsDir,
  resolveUploadsDir
} = require("./storage-paths");

const rootDir = path.resolve(__dirname, "..");

function firstCardImagePaths(dbPath) {
  if (!fs.existsSync(dbPath)) return [];
  const db = new DatabaseSync(dbPath, { readOnly: true });
  try {
    return db.prepare(`
      SELECT image.path
      FROM CardImage image
      WHERE image.rowid = (
        SELECT firstImage.rowid
        FROM CardImage firstImage
        WHERE firstImage.cardId = image.cardId
        ORDER BY firstImage.createdAt, firstImage.rowid
        LIMIT 1
      )
      ORDER BY image.cardId
    `).all().map((row) => row.path);
  } finally {
    db.close();
  }
}

async function generateHomeThumbnails({ projectRoot = rootDir, env = process.env, concurrency = 4 } = {}) {
  const dbPath = resolveDbPath(projectRoot, env);
  const uploadsDir = resolveUploadsDir(projectRoot, env);
  const thumbnailsDir = resolveThumbnailsDir(projectRoot, env);
  const imagePaths = firstCardImagePaths(dbPath);
  const summary = { total: imagePaths.length, generated: 0, cached: 0, failed: 0 };
  await fs.promises.mkdir(thumbnailsDir, { recursive: true });

  let cursor = 0;
  async function worker() {
    while (cursor < imagePaths.length) {
      const imagePath = imagePaths[cursor++];
      const sourceName = path.basename(imagePath);
      const targetName = homeThumbnailFileName(imagePath);
      if (!sourceName || !targetName) {
        summary.failed += 1;
        continue;
      }
      try {
        const result = await ensureHomeThumbnail(
          path.join(uploadsDir, sourceName),
          path.join(thumbnailsDir, targetName)
        );
        summary[result.status] += 1;
      } catch {
        summary.failed += 1;
      }
    }
  }

  await Promise.all(Array.from({ length: Math.max(1, Math.min(concurrency, 8)) }, worker));
  return summary;
}

if (require.main === module) {
  generateHomeThumbnails()
    .then((summary) => console.log(`Home thumbnails ready: ${summary.total} (${summary.generated} generated, ${summary.cached} cached, ${summary.failed} failed)`))
    .catch((error) => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    });
}

module.exports = { generateHomeThumbnails };
