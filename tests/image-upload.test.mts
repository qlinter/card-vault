import assert from "node:assert/strict";
import test from "node:test";
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

test("prepareImageUpload derives a safe extension from verified file content", async () => {
  const file = new File([Uint8Array.from([0xff, 0xd8, 0xff, 0xd9])], "unsafe.html", {
    type: "image/jpeg"
  });
  const prepared = await prepareImageUpload(file, "测试图片");

  assert.equal(prepared.extension, "jpg");
});

test("prepareImageUpload rejects a forged image MIME type", async () => {
  const file = new File(["not an image"], "fake.jpg", { type: "image/jpeg" });

  await assert.rejects(() => prepareImageUpload(file, "测试图片"), /实际文件内容/);
});
