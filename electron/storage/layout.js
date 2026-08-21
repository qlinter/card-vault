const fs = require("node:fs");
const path = require("node:path");
const { flattenNestedUploads } = require("./file-utils");

function repairDataLayout(dataDir) {
  const uploadsDir = path.join(dataDir, "uploads");
  const shareCoversDir = path.join(dataDir, "share-covers");
  const shareBackgroundsDir = path.join(dataDir, "share-backgrounds");
  const entryQueueDir = path.join(dataDir, "entry-queue");
  const rootDbPath = path.join(dataDir, "dev.db");
  const misplacedDbPath = path.join(uploadsDir, "dev.db");

  fs.mkdirSync(dataDir, { recursive: true });
  fs.mkdirSync(uploadsDir, { recursive: true });
  fs.mkdirSync(shareCoversDir, { recursive: true });
  fs.mkdirSync(shareBackgroundsDir, { recursive: true });
  fs.mkdirSync(entryQueueDir, { recursive: true });

  if (fs.existsSync(misplacedDbPath) && !fs.existsSync(rootDbPath)) fs.renameSync(misplacedDbPath, rootDbPath);
  flattenNestedUploads(uploadsDir);
  if (fs.existsSync(misplacedDbPath)) fs.rmSync(misplacedDbPath, { force: true });
}

module.exports = { repairDataLayout };
