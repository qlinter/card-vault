import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { crc32 } from "node:zlib";
import { prepareImageUpload } from "../lib/image-upload.ts";
import { cardImageSelectionError, maxCardImageRequestBytes } from "../lib/card-image-limits.js";

test("all five allowed images fit the request envelope and oversized selections fail early", () => {
  const mb = 1024 * 1024;
  assert.equal(cardImageSelectionError([{ size: 12 * mb }, { size: 12 * mb }]), "");
  const full = Array.from({ length: 5 }, () => ({ size: 15 * mb }));
  assert.equal(cardImageSelectionError(full), "");
  assert.ok(maxCardImageRequestBytes > full.reduce((sum, file) => sum + file.size, 0));
  assert.match(cardImageSelectionError([{ size: 15 * mb + 1 }]), /15MB/);
  assert.match(cardImageSelectionError(Array.from({ length: 6 }, () => ({ size: 1 }))), /5 张/);
});

for (const [format, mime, extension] of [["jpeg", "image/jpeg", "jpg"], ["png", "image/png", "png"], ["webp", "image/webp", "webp"]] as const) {
  test(`valid ${format} uploads keep their exact original bytes and use a safe extension`, async () => {
    const bytes = await sharp({ create: { width: 16, height: 24, channels: 3, background: "#ccc" } }).toFormat(format).toBuffer();
    const prepared = await prepareImageUpload(new File([new Uint8Array(bytes)], "unsafe.html", { type: mime }), "测试图片");
    assert.equal(prepared.extension, extension);
    assert.deepEqual(prepared.buffer, bytes);
    await assert.rejects(() => prepareImageUpload(new File([new Uint8Array(bytes.subarray(0, Math.floor(bytes.length / 2)))], "truncated", { type: mime }), "测试图片"), /无法解码/);
  });
}

test("signature-only files and valid PNG headers with oversized dimensions are rejected", async () => {
  for (const [type, bytes] of [
    ["image/png", Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])],
    ["image/jpeg", Buffer.from([255, 216, 255, 217])],
    ["image/webp", Buffer.from("RIFF0000WEBP")]
  ] as const) await assert.rejects(() => prepareImageUpload(new File([bytes], "broken", { type }), "测试图片"), /无法解码/);
  const huge = await sharp({ create: { width: 1, height: 1, channels: 3, background: "#ccc" } }).png().toBuffer();
  huge.writeUInt32BE(9000, 16); huge.writeUInt32BE(9000, 20);
  huge.writeUInt32BE(crc32(huge.subarray(12, 29)), 29);
  await assert.rejects(() => prepareImageUpload(new File([new Uint8Array(huge)], "huge.png", { type: "image/png" }), "测试图片"), /像素尺寸过大/);
});

test("prepareImageUpload rejects a forged image MIME type", async () => {
  const file = new File(["not an image"], "fake.jpg", { type: "image/jpeg" });

  await assert.rejects(() => prepareImageUpload(file, "测试图片"), /实际文件内容/);
});
