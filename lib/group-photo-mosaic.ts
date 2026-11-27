import { groupStyles, type Box } from "./group-photo-geometry.ts";

export function mosaicTileEdge(count: number) {
  if (!Number.isInteger(count) || count < 1 || count > groupStyles.mosaic.max) throw new RangeError("Invalid mosaic size");
  // Bound the total decoded face pixels even when thousands of originals are selected.
  return Math.min(1200, Math.floor(Math.sqrt(32_000_000 / count)));
}

/** Each face is packed upright along its long axis. Its height is one unit.
 * Keep the selected order, prefer rows with little trimming, close every seam on
 * integer pixel coordinates and distribute the last few cards across whole rows. */
export function planMosaic(aspects: number[]) {
  const count = aspects.length, edge = mosaicTileEdge(count);
  const widths = [0];
  for (const aspect of aspects) widths.push(widths.at(-1)! + Math.min(aspect, 1 / aspect));
  const area = widths[count];
  type Row = { first: number; end: number; w: number };
  let best: Row[] = [], bestScore = Infinity;
  const maxRows = Math.min(count, Math.ceil(2 * Math.sqrt(count)) + 1);
  for (let n = 1; n <= maxRows; n++) {
    const rows: Row[] = [];
    let first = 0;
    for (let r = 1; r <= n; r++) {
      const goal = widths[count] * r / n, maxEnd = count - (n - r);
      let end = first + 1;
      while (end < maxEnd && Math.abs(widths[end+1] - goal) <= Math.abs(widths[end] - goal)) end++;
      rows.push({ first, end, w: widths[end] - widths[first] });
      first = end;
    }
    const w = Math.min(...rows.map(row => row.w));
    const worstLoss = 1 - w / Math.max(...rows.map(row => row.w));
    const score = 4 * (1 - w * n / area) + worstLoss + .24 * Math.abs(Math.log(w / n / 1.4));
    if (score < bestScore) { best = rows; bestScore = score; }
  }
  const w = Math.min(...best.map(row => row.w)), h = best.length;
  const scale = Math.min(edge, 8192 / Math.max(w, h));
  const width = Math.max(1, Math.round(w * scale)), height = Math.max(1, Math.round(h * scale));
  const tiles: Box[] = [];
  for (const [index, row] of best.entries()) {
    const y = Math.round(index * scale), nextY = Math.round((index + 1) * scale);
    for (let i = row.first; i < row.end; i++) {
      const boundary = (j: number) => Math.round(width * (widths[j] - widths[row.first]) / row.w);
      const x = boundary(i);
      tiles.push({ x, y, w: boundary(i + 1) - x, h: nextY - y });
    }
  }
  return { width, height, tiles, faceLong: scale };
}
