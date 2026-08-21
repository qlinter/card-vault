const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const { reportProgress } = require("./progress");

function tableExists(db, tableName) {
  return Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(tableName));
}

function publicFileName(value, prefixes) {
  const allowedPrefixes = Array.isArray(prefixes) ? prefixes : [prefixes];
  return typeof value === "string" && allowedPrefixes.some((prefix) => value.startsWith(prefix)) ? path.basename(value) : null;
}

function directoryFiles(directoryPath) {
  if (!fs.existsSync(directoryPath)) return [];
  return fs.readdirSync(directoryPath, { withFileTypes: true }).filter((entry) => entry.isFile()).map((entry) => entry.name);
}

function inspectDataFolder(dataDir, onProgress) {
  const resolvedDataDir = path.resolve(dataDir);
  const dbPath = path.join(resolvedDataDir, "dev.db");
  const issues = [];
  const missingFiles = [];
  const orphanFiles = [];
  const counts = { cards: 0, images: 0, shares: 0, shareCovers: 0, shareBackgrounds: 0 };
  reportProgress(onProgress, 5, "正在定位数据库和媒体目录...");
  if (!fs.existsSync(dbPath)) {
    reportProgress(onProgress, 100, "健康检查完成：未找到数据库。");
    return { ok: false, checkedAt: new Date().toISOString(), dataPath: resolvedDataDir, databasePath: dbPath, integrity: "missing", counts, missingFiles, orphanFiles, issues: ["数据库文件 dev.db 不存在。"] };
  }

  const referenced = { uploads: new Set(), covers: new Set(), backgrounds: new Set() };
  let integrity = "error";
  try {
    reportProgress(onProgress, 20, "正在检查 SQLite 数据库完整性...");
    const db = new DatabaseSync(dbPath, { readOnly: true });
    try {
      const rows = db.prepare("PRAGMA integrity_check;").all();
      const valid = rows.length === 1 && Object.values(rows[0]).some((value) => String(value).toLowerCase() === "ok");
      integrity = valid ? "ok" : "failed";
      if (!valid) issues.push("SQLite 数据库完整性检查未通过。");
      if (!tableExists(db, "Card") || !tableExists(db, "CardImage")) {
        issues.push("数据库缺少 Card 或 CardImage 核心数据表。");
      } else {
        counts.cards = Number(db.prepare("SELECT COUNT(*) AS count FROM Card").get().count);
        const images = db.prepare("SELECT path FROM CardImage").all();
        counts.images = images.length;
        for (const image of images) {
          const fileName = publicFileName(image.path, ["/media/", "/uploads/"]);
          if (fileName) {
            referenced.uploads.add(fileName.toLowerCase());
            if (!fs.existsSync(path.join(resolvedDataDir, "uploads", fileName))) missingFiles.push({ type: "cardImage", path: image.path });
          }
        }
      }
      if (tableExists(db, "ShareCollection")) {
        const shares = db.prepare("SELECT coverImagePath, backgroundImagePath FROM ShareCollection").all();
        counts.shares = shares.length;
        for (const share of shares) {
          const cover = publicFileName(share.coverImagePath, "/share-covers/");
          if (cover) { referenced.covers.add(cover.toLowerCase()); if (!fs.existsSync(path.join(resolvedDataDir, "share-covers", cover))) missingFiles.push({ type: "shareCover", path: share.coverImagePath }); }
          const background = publicFileName(share.backgroundImagePath, "/share-backgrounds/");
          if (background) { referenced.backgrounds.add(background.toLowerCase()); if (!fs.existsSync(path.join(resolvedDataDir, "share-backgrounds", background))) missingFiles.push({ type: "shareBackground", path: share.backgroundImagePath }); }
        }
      }
    } finally { db.close(); }
  } catch (error) { issues.push(`无法读取数据库：${error instanceof Error ? error.message : "未知错误"}`); }

  const groups = [
    { type: "cardImage", directory: "uploads", references: referenced.uploads },
    { type: "shareCover", directory: "share-covers", references: referenced.covers },
    { type: "shareBackground", directory: "share-backgrounds", references: referenced.backgrounds }
  ];
  for (const [index, group] of groups.entries()) {
    for (const fileName of directoryFiles(path.join(resolvedDataDir, group.directory))) if (!group.references.has(fileName.toLowerCase())) orphanFiles.push({ type: group.type, path: path.join(group.directory, fileName) });
    reportProgress(onProgress, 70 + ((index + 1) / groups.length) * 25, `正在检查 ${group.directory} 目录...`);
  }
  counts.shareCovers = referenced.covers.size;
  counts.shareBackgrounds = referenced.backgrounds.size;
  if (missingFiles.length > 0) issues.push(`发现 ${missingFiles.length} 个数据库引用的文件缺失。`);
  const result = { ok: integrity === "ok" && issues.length === 0, checkedAt: new Date().toISOString(), dataPath: resolvedDataDir, databasePath: dbPath, integrity, counts, missingFiles, orphanFiles, issues };
  reportProgress(onProgress, 100, result.ok ? "数据健康检查通过。" : "数据健康检查发现问题。");
  return result;
}

module.exports = { inspectDataFolder };
