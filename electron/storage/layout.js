const fs = require("node:fs");
const path = require("node:path");

function repairDataLayout(dataDir) {
  const uploadsDir = path.join(dataDir, "uploads");
  if (fs.existsSync(path.join(uploadsDir, "dev.db")) || fs.existsSync(path.join(uploadsDir, "uploads"))) {
    throw new Error("数据目录不是当前布局，未移动、转换或删除文件。请使用当前格式的完整数据目录。");
  }
  const thumbnailsDir = path.join(dataDir, "thumbnails");
  const shareCoversDir = path.join(dataDir, "share-covers");
  const shareBackgroundsDir = path.join(dataDir, "share-backgrounds");
  const entryQueueDir = path.join(dataDir, "entry-queue");

  fs.mkdirSync(dataDir, { recursive: true });
  fs.mkdirSync(uploadsDir, { recursive: true });
  fs.mkdirSync(thumbnailsDir, { recursive: true });
  fs.mkdirSync(shareCoversDir, { recursive: true });
  fs.mkdirSync(shareBackgroundsDir, { recursive: true });
  fs.mkdirSync(entryQueueDir, { recursive: true });

}

module.exports = { repairDataLayout };
