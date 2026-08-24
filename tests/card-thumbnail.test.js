const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const sharp = require("sharp");
const {
  ensureHomeThumbnail,
  homeThumbnailFileName,
  homeThumbnailMaxEdge,
  homeThumbnailPublicPath,
  removeHomeThumbnail,
  sourceFileNameFromHomeThumbnail
} = require("../lib/card-thumbnail-core.js");

test("home thumbnail names preserve a safe reversible source basename", () => {
  assert.equal(homeThumbnailFileName("/media/card 01.jpg"), "card 01.jpg.home.webp");
  assert.equal(homeThumbnailPublicPath("/media/card 01.jpg"), "/thumbnails/card%2001.jpg.home.webp");
  assert.equal(sourceFileNameFromHomeThumbnail("card 01.jpg.home.webp"), "card 01.jpg");
  assert.equal(sourceFileNameFromHomeThumbnail("card.webp"), null);
});

test("home thumbnails are bounded WebP files, reusable, and removable", async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "card-vault-thumbnail-test-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const sourcePath = path.join(root, "source.png");
  const thumbnailsDir = path.join(root, "thumbnails");
  const targetPath = path.join(thumbnailsDir, homeThumbnailFileName(sourcePath));

  await sharp({
    create: { width: 1800, height: 1200, channels: 3, background: { r: 25, g: 80, b: 140 } }
  }).png().toFile(sourcePath);

  const generated = await ensureHomeThumbnail(sourcePath, targetPath);
  const metadata = await sharp(await fs.promises.readFile(targetPath)).metadata();
  assert.equal(generated.status, "generated");
  assert.equal(metadata.format, "webp");
  assert.ok(Math.max(metadata.width || 0, metadata.height || 0) <= homeThumbnailMaxEdge);

  const cached = await ensureHomeThumbnail(sourcePath, targetPath);
  assert.equal(cached.status, "cached");

  await removeHomeThumbnail(thumbnailsDir, sourcePath);
  assert.equal(fs.existsSync(targetPath), false);
});
