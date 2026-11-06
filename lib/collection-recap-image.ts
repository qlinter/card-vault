import "server-only";
import sharp, { type OverlayOptions } from "sharp";
import { lstat, realpath } from "node:fs/promises";
import path from "node:path";
import { getUploadsDir } from "./storage-paths";
import { managedImageFilename } from "./card-image-export";
import { recapChart, recapStats } from "./collection-recap";
import type { RecapCard, RecapSpec, RecapSummary } from "./collection-recap";
import { translateUiText } from "./ui-translations";

const escape = (value: string) => value.replace(/[<>&"']/g, char => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[char]!).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "");
function wrap(value: string, width: number) {
  const lines: string[] = []; let line = "", units = 0;
  for (const char of value) { const size = /[^\x00-\xff]/.test(char) ? 1 : .55; if (char === "\n" || units + size > width) { lines.push(line); line = ""; units = 0; } if (char !== "\n") { line += char; units += size; } }
  if (line) lines.push(line); return lines;
}

/** One bounded, self-contained raster artifact; no HTML, remote assets, or card notes. */
export async function renderRecapImage(input: { spec: RecapSpec; summary: RecapSummary; cards: RecapCard[]; title: string; locale: string; includePrivate: boolean }, output: string, signal: AbortSignal) {
  const { spec, summary, cards } = input, t = (value: string) => input.locale === "en" ? translateUiText(value) : value;
  const width = 1200, margin = 64, parts: string[] = [], composites: OverlayOptions[] = [];
  let y = 68;
  const text = (value: string, x: number, at: number, size = 26, weight = 400, fill = "#283141", anchor = "start") => `<text x="${x}" y="${at}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}">${escape(value)}</text>`;
  const lines = (value: string, size: number, columns: number, weight = 400) => { for (const line of wrap(value, columns)) { parts.push(text(line, margin, y, size, weight)); y += size * 1.5; } };
  lines(input.title, 50, 21, 700); y += 12;
  lines(`${spec.year}${spec.month ? ` / ${spec.month}` : ""} · ${t(spec.basis === "purchase" ? "购入回顾" : "录入回顾")}${summary.inProgress ? ` · ${t("截至当前")} ${summary.asOf.slice(0, 10)}` : ""}`, 24, 43);
  lines(t(input.includePrivate ? "包含私密卡片" : "已排除私密卡片"), 22, 48); y += 28;
  const stats = recapStats(spec, summary);
  for (const [index, stat] of stats.entries()) { const x = margin + (index % 3) * 355 + 165, at = y + Math.floor(index / 3) * 100; parts.push(text(String(stat.value), x, at + 36, 40, 700, "#283141", "middle"), text(t(stat.label), x, at + 74, 23, 400, "#283141", "middle")); }
  y += 220; lines(t(spec.month ? "每周活动" : "每月活动"), 30, 35, 700); y += 90;
  const chart = recapChart(spec, summary), step = (width - margin * 2) / chart.length, maximum = Math.max(1, ...chart.map(row => row.count));
  for (const [index, item] of chart.entries()) { const x = margin + index * step + (step - 40) / 2, height = Math.max(3, 80 * item.count / maximum); parts.push(`<rect x="${x}" y="${y - height}" width="40" height="${height}" rx="5" fill="#78889a"/>`, text(String(item.count), x + 20, y - height - 10, 19, 400, "#283141", "middle"), text(item.label + t(spec.month ? "日" : "月"), x + 20, y + 30, 20, 400, "#283141", "middle")); }
  y += 68;
  if (summary.missingPurchases) lines(t("范围内 {0} 个档案没有购入记录，未纳入购入回顾。").replace("{0}", String(summary.missingPurchases)), 22, 48);
  y += 16; lines(t("代表卡片"), 30, 35, 700);
  const uploads = await realpath(getUploadsDir());
  for (const [index, card] of cards.entries()) {
    signal.throwIfAborted();
    const x = margin + (index % 2) * 550, top = y + Math.floor(index / 2) * 590, image = card.images[0];
    parts.push(`<rect x="${x}" y="${top}" width="520" height="440" rx="16" fill="#edf0f3"/>`);
    let available = false;
    if (image) try {
      const source = path.join(uploads, managedImageFilename(image.path));
      if (!(await lstat(source)).isFile() || path.dirname(await realpath(source)) !== uploads) throw new Error("Unavailable image");
      const buffer = await sharp(source, { limitInputPixels: 100000000 }).rotate(image.rotation).resize(480, 400, { fit: "contain", background: "#edf0f3" }).png().toBuffer();
      signal.throwIfAborted(); composites.push({ input: buffer, left: x + 20, top: top + 20 }); available = true;
    } catch { signal.throwIfAborted(); }
    if (!available) parts.push(text(t("暂无卡图"), x + 150, top + 230, 26));
    parts.push(text(wrap(card.playerName, 22)[0] ?? "", x, top + 482, 27, 700));
    for (const [line, title] of wrap(card.cardTitle, 27).slice(0, 2).entries()) parts.push(text(title, x, top + 518 + line * 31, 23));
    if (card.collectionStatus === "sold") parts.push(text(t("当前已售出"), x, top + 579, 20));
  }
  y += Math.ceil(cards.length / 2) * 590 + 30;
  lines(t("数据按当前档案重新计算"), 21, 50);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${Math.ceil(y + 50)}"><rect width="100%" height="100%" fill="#fafbfc"/><g font-family="Microsoft YaHei,Arial,sans-serif">${parts.join("")}</g></svg>`;
  signal.throwIfAborted(); await sharp(Buffer.from(svg)).composite(composites).png().toFile(output); signal.throwIfAborted();
}
