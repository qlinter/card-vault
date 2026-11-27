import assert from "node:assert/strict";
import { test } from "node:test";
import sharp from "sharp";
import { singleCardStudioEdit, studioReferenceImages } from "../lib/studio-card-edit.ts";

test("Schumacher regeneration uses the replacement front and the background swatch and requests an ungraded holder", () => {
  const card = { playerName: "Michael Schumacher", cardTitle: "2024 Topps Chrome F1 Legend", cardNumber: "192", serialNumber: "10", gradingCompany: null, grade: null, certNumber: null };
  const replacement = Buffer.from("replacement front");
  const backdrop = Buffer.from("lighting and tabletop");
  const stand = Buffer.from("acrylic feet and contact shadows");
  for (const orientation of [undefined, "portrait", "landscape"] as const) {
    const edit = singleCardStudioEdit(card, replacement, { backdrop, stand }, orientation, false);
    assert.deepEqual(edit.images, [
      { name: "card-front.png", png: replacement },
      { name: "studio-background.png", png: backdrop },
      { name: "acrylic-stand.png", png: stand }
    ]);
    const direction = orientation === "landscape" ? "horizontal" : orientation === "portrait" ? "vertical" : "by its printed artwork";
    assert.ok(edit.prompt.includes(direction));
    assert.doesNotMatch(edit.prompt, /Schumacher|Topps|192|serial 10/i);
    assert.match(edit.prompt, /lettering, numbering/);
    assert.match(edit.prompt, /standard clear, unlabelled magnetic one-touch/);
    assert.match(edit.prompt, /clear acrylic stand in image 3/);
  }
  const graded = singleCardStudioEdit({ ...card, gradingCompany: "BGS", grade: "9.5", certNumber: "0010392" }, replacement, { backdrop, stand }, undefined, false);
  assert.match(graded.prompt, /grade and certificate number as printed/);
  assert.doesNotMatch(graded.prompt, /Schumacher|Topps|0010392/);
  assert.doesNotMatch(graded.prompt, /one-touch/);
});

test("an oversized card with only a certificate keeps its label and rests directly on the plinth", () => {
  const card = { gradingCompany: null, grade: null, certNumber: "00123" };
  const front = Buffer.from("graded front");
  const references = { backdrop: Buffer.from("plinth"), stand: Buffer.from("stand") };
  const edit = singleCardStudioEdit(card, front, references, "portrait", true);
  assert.deepEqual(edit.images.map(image => image.png), [front, references.backdrop]);
  assert.match(edit.prompt, /Keep the original grading holder/);
  assert.match(edit.prompt, /directly on the plinth/);
  assert.doesNotMatch(edit.prompt, /image 3|acrylic stand|00123/);
});

test("the studio uploads square PNG references made from the two card-free regions", async () => {
  const sample = "public/studio-style/portrait.png";
  const { backdrop, stand } = await studioReferenceImages(sample);
  for (const png of [backdrop, stand]) {
    const { width, height, format } = await sharp(png).metadata();
    assert.deepEqual([width, height, format], [1024, 1024, "png"]);
  }
  assert.notDeepEqual(backdrop, stand);
});
