import assert from "node:assert/strict";
import test from "node:test";
import { fitShowcaseImage, showcaseFacts } from "../lib/showcase-presentation.ts";

test("portrait, landscape, grading cases and all rotations fit without cropping", () => {
  for (const [width, height] of [[600, 840], [840, 600], [660, 1100], [3000, 4000], [1, 1]]) {
    for (const rotation of [0, 90, 180, 270, -90, 360, 45]) {
      const fit = fitShowcaseImage(width, height, 222, 305, rotation)!;
      const angle = rotation * Math.PI / 180;
      const bounds = [fit.width * Math.abs(Math.cos(angle)) + fit.height * Math.abs(Math.sin(angle)), fit.width * Math.abs(Math.sin(angle)) + fit.height * Math.abs(Math.cos(angle))];
      assert.ok(bounds[0] <= 222 + 1e-8 && bounds[1] <= 305 + 1e-8);
      assert.ok(Math.abs(bounds[0] - 222) < 1e-8 || Math.abs(bounds[1] - 305) < 1e-8);
      assert.ok(Math.abs(fit.width / fit.height - width / height) < 1e-8);
    }
  }
});

test("unloaded images and collapsed frames do not produce invalid dimensions", () => {
  for (const dimensions of [[0, 10, 100, 200], [10, 10, 0, 0], [NaN, 10, 100, 100], [10, Infinity, 100, 100]]) assert.equal(fitShowcaseImage(...dimensions as [number, number, number, number], 0), null);
});

test("display facts omit empty values and preserve collector text and serial formatting", () => {
  assert.deepEqual(showcaseFacts({}), []);
  const facts = showcaseFacts({ brand: " Aurora ", productLine: "Aurora", serialNumber: "08", serialRange: "/99", gradingCompany: "PSA", grade: "10" });
  assert.deepEqual(facts.map(fact => fact.value), ["Aurora", "PSA 10", "08/99"]);
  assert.equal(showcaseFacts({ serialRange: "50" })[0].value, "/50");
  assert.equal(showcaseFacts({ serialNumber: "1 of 1" })[0].value, "1 of 1");
});
