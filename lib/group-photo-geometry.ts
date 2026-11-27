export type Box = { x: number; y: number; w: number; h: number };
export type Framing = { holder: Box; face: Box; foot: number; standLeft: number; standRight: number; hooks: boolean };

// All distances below use the same isotropic survey pixels, including rotated cards.
// The physical reference is the paper insert (2.5 × 3.5 inches), inside either holder.
export function measureCard(pixels: Uint8ClampedArray, w: number, h: number, graded: boolean, studio: boolean): Framing {
  const stride = w + 1;
  const vertical = new Float32Array(stride * (h + 1));
  const horizontal = new Float32Array(vertical.length);
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = 4 * (y * w + x);
    const edge = (offset: number) => {
      const a = i - offset, b = i + offset;
      return Math.min(42, Math.max(Math.abs(pixels[a] - pixels[b]), Math.abs(pixels[a+1] - pixels[b+1]), Math.abs(pixels[a+2] - pixels[b+2])));
    };
    const k = y * stride + x;
    vertical[k + stride] = vertical[k] + edge(4);
    horizontal[k + 1] = horizontal[k] + edge(4 * w);
  }
  function border(x: number, y: number, rw: number, rh: number) {
    const l = Math.max(1, Math.round(x)), r = Math.min(w - 2, Math.round(x + rw));
    const t = Math.max(1, Math.round(y)), b = Math.min(h - 2, Math.round(y + rh));
    if (r <= l || b <= t) return 0;
    const v = (col: number) => (vertical[b * stride + col] - vertical[t * stride + col]) / (b - t);
    const u = (row: number) => (horizontal[row * stride + r] - horizontal[row * stride + l]) / (r - l);
    return (v(l) + v(r) + u(t) + u(b) + Math.min(v(l), v(r)) + Math.min(u(t), u(b))) / 6;
  }
  let holder: Box = { x: 0, y: 0, w, h };
  if (studio) {
    // Trace the outside of both vertical rims through the central part of the photo.
    // The slanted window light and horizontal tabletop have little vertical continuity.
    const t = Math.round(.38 * h), b = Math.round(.62 * h);
    const rim = (x: number) => (vertical[b * stride + x] - vertical[t * stride + x]) / (b - t);
    const middle = Math.floor(w / 2);
    let left = 1, right = w - 2;
    while (left < middle && rim(left) < 11) left++;
    while (right > middle && rim(right) < 11) right--;
    if (right - left > w * .26) {
      const sideStrength = (x: number, y: number, sign: number) => {
        let peak = 0;
        for (let j = -1; j <= 5; j++) {
          const col = Math.max(1, Math.min(w - 2, x + sign * j));
          peak = Math.max(peak, (vertical[(y + 2) * stride + col] - vertical[(y - 1) * stride + col]) / 3);
        }
        return peak;
      };
      const end = (step: number) => {
        let quiet = 0, last = Math.round(.5 * h);
        for (let y = last; y >= 2 && y < h - 3; y += step) {
          if (Math.min(sideStrength(left, y, 1), sideStrength(right, y, -1)) >= 8) { last = y; quiet = 0; }
          else if (++quiet >= 4) break;
        }
        return last;
      };
      const top = Math.max(0, end(-1) - 1), bottom = Math.min(h, end(1) + 1);
      if (bottom - top > h * .22) holder = { x: left, y: top, w: right - left + 1, h: bottom - top };
    }
  }
  const short = Math.min(holder.w, holder.h), long = Math.max(holder.w, holder.h);
  let face = holder, best = -Infinity;
  // A raw portrait photograph can contain a landscape card (or the reverse).
  for (const wide of studio ? [holder.w > holder.h] : [false, true]) {
    const maxShort = wide ? Math.min(holder.h, holder.w * 5 / 7) : Math.min(holder.w, holder.h * 5 / 7);
    const expectedShort = Math.min(short * (studio ? graded ? .80 : .86 : .95), long * 5 / 7);
    for (let s = Math.max(2, Math.round(expectedShort * (studio ? .81 : .43))); s <= maxShort; s++) {
      const rw = wide ? s * 7 / 5 : s, rh = wide ? s : s * 7 / 5;
      const freeX = holder.w - rw, freeY = holder.h - rh;
      for (let dx = 0; dx <= freeX + .5; dx += 2) for (let dy = 0; dy <= freeY + .5; dy += 2) {
        const x = holder.x + dx, y = holder.y + dy;
        const targetY = studio && !wide ? (graded ? .78 : .62) : .5;
        const xDeviation = wide && graded ? Math.min(Math.abs(dx - .2 * freeX), Math.abs(dx - .8 * freeX)) : Math.abs(dx - .5 * freeX);
        const score = border(x, y, rw, rh) - 44 * Math.abs(s / expectedShort - 1) - 48 * (xDeviation / holder.w + Math.abs(dy - freeY * targetY) / holder.h);
        if (score > best) { best = score; face = { x, y, w: rw, h: rh }; }
      }
    }
  }
  const bottom = holder.y + holder.h, middle = holder.x + holder.w / 2;
  let foot = bottom, standLeft = middle - holder.w * .28, standRight = middle + holder.w * .28;
  if (studio) {
    for (let y = Math.min(h - 3, Math.round(bottom + h * .135)); y > bottom + 2; y--) {
      const edges = [];
      for (let x = Math.ceil(holder.x + holder.w * .08); x < holder.x + holder.w * .92; x++) {
        if ((vertical[(y + 2) * stride + x] - vertical[(y - 1) * stride + x]) / 3 > 10) edges.push(x);
      }
      if (edges.length >= 4 && edges[0] < middle - holder.w * .12 && edges.at(-1)! > middle + holder.w * .12) {
        foot = y + 2; standLeft = edges[0] - 1; standRight = edges.at(-1)! + 1; break;
      }
    }
  }
  return { holder, face, foot, standLeft, standRight, hooks: studio && holder.w > holder.h && holder.y > h * .08 };
}

export const groupPhotoLimit = 36;
export const groupStageLimit = 5;
export const groupStyles = {
  stage: { zh: "精选陈列", en: "Display plinth", min: 1, max: groupStageLimit },
  tiers: { zh: "错层看台", en: "Stepped plinth", min: 3, max: 7 },
  wall: { zh: "系列展墙", en: "Gallery wall", min: 1, max: groupPhotoLimit },
  mosaic: { zh: "无缝拼图", en: "Card mosaic", min: 1, max: 4096 }
} as const;
export type ExhibitSize = { width: number; height: number; faceLong: number };
export type GroupPhotoStyle = keyof typeof groupStyles;

export function planGroupPhoto(exhibits: ExhibitSize[], style: Exclude<GroupPhotoStyle,"mosaic">, title: boolean) {
  if (exhibits.length < groupStyles[style].min || exhibits.length > groupStyles[style].max) throw new RangeError("Invalid exhibit count");
  const wall = style === "wall", width = 2400, inset = wall ? 85 : 80;
  const columns = wall ? Math.min(exhibits.length, exhibits.length > 12 ? 4 : 3) : exhibits.length;
  const rows = Math.ceil(exhibits.length / columns), cell = (width - 2 * inset) / columns;
  const maxHeight = wall ? 680 : 1020, header = title && wall ? 176 : wall ? 65 : 54;
  // Solve once for the entire wall. A large slab or a wide card reduces the common
  // scale, so the incomplete final row and the centrepiece share the same face size.
  const faceLong = Math.min(...exhibits.map(item => Math.min(cell * .91 * item.faceLong / item.width, maxHeight * item.faceLong / item.height)));
  const objectHeights = exhibits.map(item => item.height * faceLong / item.faceLong);
  const lifts = exhibits.map(() => 0);
  if (style === "tiers") {
    const step = Math.min(cell * .19, Math.max(...objectHeights) * .16);
    for (let left = 1, right = columns - 2; left <= right; left++, right--) {
      // A landscape centrepiece sits lower on its stand than a portrait slab.
      // Raise the paired plinths together so the centre is visibly highest.
      const outer = Math.max(objectHeights[left-1], objectHeights[right+1]);
      const inner = Math.min(objectHeights[left], objectHeights[right]);
      const lift = lifts[left-1] + Math.max(step, outer - inner + step * .25);
      lifts[left] = lift;
      lifts[right] = lift;
    }
  }
  const bay = Math.ceil(Math.max(...objectHeights.map((height, i) => height + lifts[i])) + (wall ? 213 : 248)), gap = wall ? 20 : 0;
  const height = header + rows * (bay + gap) + (title && !wall ? 95 : 25);
  const items = exhibits.map((item, i) => {
    const row = Math.floor(i / columns), count = Math.min(columns, exhibits.length - row * columns);
    const scale = faceLong / item.faceLong;
    const cx = width / 2 + (i % columns - (count - 1) / 2) * cell;
    const foot = header + row * (bay + gap) + bay - (wall ? 102 : 116);
    return { cx, foot: foot - lifts[i], lift: lifts[i], width: item.width * scale, height: item.height * scale, scale };
  });
  return { width, height, inset, rows, columns, header, bay, gap, faceLong, items };
}
