const fs = require("node:fs/promises");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const sharp = require("sharp");
const { studioFilename } = require("../../lib/studio-file");

async function inspectStudioHealth(dataDir) {
  const db = new DatabaseSync(path.join(dataDir, "dev.db"), { readOnly: true });
  let cards;
  try {
    cards = db.prepare(`SELECT c.id, c.cardTitle, i.id AS imageId, i.path, i.rotation FROM Card c
      JOIN CardImage i ON i.id = (SELECT id FROM CardImage WHERE cardId = c.id ORDER BY sortOrder,createdAt,id LIMIT 1)
      ORDER BY c.cardTitle,c.id`).all();
  } finally { db.close(); }
  const directory = path.join(dataDir, "studio-images");
  const entries = await fs.readdir(directory, { withFileTypes: true }).catch(error => {
    if (error.code === "ENOENT") return [];
    throw error;
  });
  const files = new Set(entries.filter(entry => entry.isFile() && entry.name.endsWith(".png")).map(entry => entry.name));
  const result = { ready: 0, missing: [], damaged: [], historical: [] };
  for (const card of cards) {
    const name = studioFilename({ ...card, images: [{ id: card.imageId, path: card.path, rotation: card.rotation }] });
    const item = { id: card.id, title: card.cardTitle };
    if (!files.delete(name)) { result.missing.push(item); continue; }
    try {
      const image = sharp(path.join(directory, name), { failOn: "warning" });
      if ((await image.metadata()).format !== "png") throw new Error("Expected PNG");
      await image.stats();
      result.ready++;
    } catch { result.damaged.push(item); }
  }
  result.historical = [...files].sort();
  return result;
}
module.exports = { inspectStudioHealth };
