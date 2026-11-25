const { createHash } = require("node:crypto");
function oversized(card) {
  return card.id === "cmniroib20006aulo4cvtlxn2" || /^2016[-–]17 Panini Immaculate Special Event Materials Manu Ginobili\s*\/\s*Tim Duncan\s*\/\s*Tony(?: Parker)?$/i.test(card.cardTitle.trim());
}
function studioFilename(card) {
  const front = card.images[0];
  if (!front) return null;
  const digest = createHash("sha256").update(JSON.stringify([card.id, front.id, front.path, front.rotation, oversized(card)])).digest("hex");
  return digest + ".png";
}

module.exports = { studioFilename, oversized };
