import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import sharp from "sharp";
import {
  createShareExportImageVariants,
  shareExportImageMaxEdge,
  shareExportThumbnailMaxEdge
} from "../lib/share-export-images.ts";

test("share export creates bounded WebP display and thumbnail variants", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "card-vault-share-image-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const source = path.join(root, "source.png");
  await writeFile(source, await sharp({
    create: { width: 2400, height: 3200, channels: 3, background: "#335577" }
  }).png().toBuffer());

  const result = await createShareExportImageVariants({
    sourcePath: source,
    targetDirectory: root,
    baseName: "card"
  });
  const full = await sharp(await readFile(path.join(root, "card.webp"))).metadata();
  const thumbnail = await sharp(await readFile(path.join(root, "card-thumb.webp"))).metadata();

  assert.equal(result.fileCount, 2);
  assert.equal(full.format, "webp");
  assert.ok(Math.max(full.width ?? 0, full.height ?? 0) <= shareExportImageMaxEdge);
  assert.ok(Math.max(thumbnail.width ?? 0, thumbnail.height ?? 0) <= shareExportThumbnailMaxEdge);
  assert.deepEqual(result.image, {
    src: "assets/images/card.webp",
    thumbnailSrc: "assets/images/card-thumb.webp",
    width: full.width,
    height: full.height,
    rotation: 0,
    sourceRotation: 0
  });
});

test("share export physically applies the persisted card-image rotation", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "card-vault-share-rotation-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const source = path.join(root, "portrait.png");
  await writeFile(source, await sharp({
    create: { width: 400, height: 800, channels: 3, background: "#664422" }
  }).png().toBuffer());

  const result = await createShareExportImageVariants({
    sourcePath: source,
    targetDirectory: root,
    baseName: "rotated",
    rotation: 90
  });
  const full = await sharp(await readFile(path.join(root, "rotated.webp"))).metadata();

  assert.ok((full.width ?? 0) > (full.height ?? 0));
  assert.equal(result.image.rotation, 0);
  assert.equal(result.image.sourceRotation, 90);
});
