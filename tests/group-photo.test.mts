import assert from "node:assert/strict";
import test from "node:test";
import { measureCard, planGroupPhoto } from "../lib/group-photo-geometry.ts";
import { planMosaic } from "../lib/group-photo-mosaic.ts";

test("stepped plinths rise symmetrically towards the centre at one face scale", () => {
  const cases = [{width:190,height:275,faceLong:190}, {width:250,height:185,faceLong:210}, {width:180,height:305,faceLong:183}];
  const layout = planGroupPhoto(cases, "tiers", true);
  const [left, centre, right] = layout.items;
  assert.equal(left.foot, right.foot);
  assert.ok(centre.foot < left.foot);
  assert.ok(centre.foot - centre.height < Math.min(left.foot - left.height, right.foot - right.height));
  for (let n = 3; n <= 7; n++) {
    const items = planGroupPhoto(Array(n).fill(cases[0]), "tiers", false).items;
    assert.equal(items[0].lift, 0);
    for (let i = 0; i < Math.ceil(n / 2); i++) {
      assert.equal(items[i].foot, items[n - 1 - i].foot);
      if (i > 0) assert.ok(items[i].foot < items[i-1].foot);
    }
  }
  for (const [i, item] of layout.items.entries()) {
    assert.ok(Math.abs(cases[i].faceLong * item.scale - layout.faceLong) < .001);
    assert.ok(item.foot > item.height);
  }
  for (const n of [2,8]) assert.throws(() => planGroupPhoto(Array(n).fill(cases[0]), "tiers", false));
});

test("mosaic fills every pixel once, in sequence, including mixed and prime counts up to 4096", () => {
  for (const count of [1,2,3,7,11,37,109,509,4096]) {
    const aspects = Array.from({ length: count }, (_, i) => i % 3 === 1 ? 7/5 : 5/7);
    const { width, height, tiles, faceLong } = planMosaic(aspects);
    assert.equal(tiles.length, count);
    assert.ok(width <= 8192 && height <= 8192 && width * height <= 32_100_000);
    let x = 0, y = 0, rowHeight = tiles[0].h;
    for (const [i, tile] of tiles.entries()) {
      if (x === width) { y += rowHeight; x = 0; rowHeight = tile.h; }
      assert.deepEqual([tile.x,tile.y,tile.h], [x,y,rowHeight]);
      assert.ok(tile.w > 0 && tile.h > 0);
      assert.ok(tile.w < tile.h);
      assert.ok(tile.w <= faceLong * Math.min(aspects[i], 1/aspects[i]) + 1);
      assert.ok(Math.abs(tile.h - faceLong) <= 1);
      x += tile.w;
    }
    assert.deepEqual([x, y+rowHeight],[width,height]);
  }
  assert.throws(() => planMosaic(Array(4097).fill(1)));
});

test("printed faces have one physical scale across orientations, cases and an incomplete shelf", () => {
  const graded = { width: 160, height: 295, faceLong: 177 };
  const magnetic = { width: 238, height: 208, faceLong: 184 };
  const largerScan = { width: 320, height: 590, faceLong: 354 };
  const assets = [graded, magnetic, largerScan, magnetic];
  const layout = planGroupPhoto(assets, "wall", true);
  assert.equal(layout.rows, 2);
  assert.equal(layout.items.at(-1)!.cx, layout.width / 2);
  for (const [i, item] of layout.items.entries()) {
    assert.ok(Math.abs(item.scale * assets[i].faceLong - layout.faceLong) < .0001);
    assert.ok(item.cx + item.width / 2 <= layout.width);
    assert.ok(item.foot - item.height > 0);
  }
  assert.equal(layout.items[0].height, layout.items[2].height);
  assert.ok(layout.items[0].height > layout.items[1].height);
  assert.throws(() => planGroupPhoto([], "stage", false));
  assert.throws(() => planGroupPhoto(Array(37).fill(graded), "wall", true));
});

test("measures the printed rectangle inside a slab with a separate label", () => {
  const w = 204, h = 273, pixels = new Uint8ClampedArray(w * h * 4).fill(220);
  function fill(x: number, y: number, width: number, height: number, value: number) {
    for (let row = y; row < y + height; row++) for (let col = x; col < x + width; col++) {
      const i = 4 * (row * w + col); pixels.fill(value, i, i + 3);
    }
  }
  fill(42, 26, 120, 201, 143); fill(47, 34, 110, 29, 202); fill(54, 77, 95, 133, 41);
  const { face, holder } = measureCard(pixels, w, h, true, true);
  assert.ok(Math.abs(holder.h - 201) < 7);
  assert.ok(Math.abs(face.h - 133) < 5);
  assert.ok(Math.abs(face.y - 77) < 4);
});
