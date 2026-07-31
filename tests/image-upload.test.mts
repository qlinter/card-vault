import assert from "node:assert/strict";
import test from "node:test";
import { prepareImageUpload } from "../lib/image-upload.ts";

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
