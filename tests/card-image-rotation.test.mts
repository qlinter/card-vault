import assert from "node:assert/strict";
import test from "node:test";
import {
  cardImageRotationStyle,
  normalizeCardImageRotation,
  readCardImageRotationRecord,
  readNewCardImageRotations,
  rotateCardImageDegrees,
  toPersistedCardImageRotation
} from "../lib/card-image-rotation.ts";

test("图片旋转只接受四个直角方向", () => {
  assert.equal(normalizeCardImageRotation(90), 90);
  assert.equal(normalizeCardImageRotation("270"), 270);
  assert.equal(normalizeCardImageRotation(45), 0);
  assert.match(String(cardImageRotationStyle(90).transform), /rotate\(90deg\)/);
});

test("图片交互旋转始终按点击方向连续转动九十度", () => {
  assert.equal(rotateCardImageDegrees(270, 1), 360);
  assert.equal(rotateCardImageDegrees(0, -1), -90);
  assert.equal(toPersistedCardImageRotation(360), 0);
  assert.equal(toPersistedCardImageRotation(-90), 270);
  assert.match(String(cardImageRotationStyle(360, { continuous: true }).transform), /rotate\(360deg\)/);
  assert.match(String(cardImageRotationStyle(-90, { continuous: true }).transform), /rotate\(-90deg\)/);
});

test("图片旋转表单严格校验现有图和新增图", () => {
  const formData = new FormData();
  formData.set("existingImageRotations", JSON.stringify({ "image-1": 90, "image-2": 270 }));
  formData.set("newImageRotations", JSON.stringify([180, 0]));
  assert.deepEqual(readCardImageRotationRecord(formData, "existingImageRotations"), { "image-1": 90, "image-2": 270 });
  assert.deepEqual(readNewCardImageRotations(formData, 2), [180, 0]);

  formData.set("newImageRotations", JSON.stringify([45]));
  assert.throws(() => readNewCardImageRotations(formData, 1), /旋转信息/);
});
