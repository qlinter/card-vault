import assert from "node:assert/strict";
import test from "node:test";
import { exportImageFilename, managedImageFilename } from "../lib/card-image-export.ts";

test("image downloads retain readable Unicode names and sanitize filesystem characters", () => {
  assert.equal(exportImageFilename('球星卡 / 1:1\n"珍藏"', 1, ".jpg"), "球星卡 - 1-1--珍藏--02.jpg");
  assert.equal(exportImageFilename(" . ", 0, ".png"), "card-01.png");
  assert.doesNotThrow(() => encodeURIComponent(exportImageFilename("😀".repeat(90), 0, ".webp")));
});

test("image downloads accept only managed original image paths", () => {
  assert.equal(managedImageFilename("/media/original.webp"), "original.webp");
  for (const value of ["/media/../secret.png", "/media/sub/file.jpg", "/media/..\\file.jpg", "C:\\secret.png", "/thumbnails/picture.png", "/media/file.svg", "/media/secret.png:stream.jpg", "https://example.com/image.jpg"]) {
    assert.throws(() => managedImageFilename(value));
  }
});
