import { cardImageOrder } from "./card-image-order.ts";
import "server-only";
import { studioFilename, oversized } from "./studio-file.js";
import { randomUUID } from "node:crypto";
import { lstat, realpath, mkdir, open, readFile, rename, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { getStudioAiSettings, hasStudioKey } from "./ai-settings";
import { inspectStudioOrientation } from "./studio-orientation";
import { fetchAi } from "./ai-fetch";
import { prisma } from "./prisma";
import { getUploadsDir, getThumbnailsDir, resolveDataDir } from "./storage-paths";

const select = {
  id: true, cardTitle: true, gradingCompany: true, grade: true,
  images: { take: 1, orderBy: cardImageOrder, select: { id: true, path: true, rotation: true } }
};
import type { StudioCard } from "./studio-file.js";
const directory = () => path.join(resolveDataDir(), "studio-images");
export function studioFile(card: StudioCard) {
  const name = studioFilename(card);
  return name ? path.join(directory(), name) : null;
}
export async function removeStudioFile(file: string | null) {
  if (file) await unlink(file).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== "ENOENT") console.warn("Could not clean up a retired studio image.");
  });
}

export async function existingStudioFile(card: StudioCard) {
  const file = studioFile(card);
  return file && (await fileStat(file))?.isFile() ? file : null;
}
export function studioImageUrl(id: string, thumbnail = false) {
  return "/api/immersive?studio=" + (thumbnail ? "thumbnail" : "png") + "&id=" + encodeURIComponent(id);
}

export async function showcasePhotos(card: StudioCard, preferStudio: boolean) {
  if (!preferStudio || !await existingStudioFile(card)) return card.images;
  return [{ id: "studio-" + card.images[0].id, path: studioImageUrl(card.id), rotation: 0 }];
}

export async function studioInventory() {
  const cards = await prisma.card.findMany({ select, orderBy: { id: "asc" } });
  const pending: string[] = [];
  let ready = 0, missingFront = 0;
  for (const card of cards) {
    if (!card.images.length) missingFront++;
    else if (await existingStudioFile(card)) ready++;
    else pending.push(card.id);
  }
  return { ready, pending, missingFront };
}

async function fileForCard(id: string) {
  const card = await prisma.card.findUnique({ where: { id }, select });
  return card && studioFile(card);
}

async function fileStat(file: string) {
  try { return await stat(file); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return null; throw error; }
}
const lockTimeout = 15 * 60_000;
async function lockStudioFile(file: string) {
  const lock = file + ".lock";
  // Each desktop instance can resume work abandoned by a previous process.
  const stale = await fileStat(lock);
  if (stale && Date.now() - stale.mtimeMs > lockTimeout) await unlink(lock).catch(() => {});
  const handle = await open(lock, "wx").catch((error: NodeJS.ErrnoException) => {
    if (error.code === "EEXIST") throw new Error("这张卡牌正在生成。");
    throw error;
  });
  return async () => { await handle.close(); await unlink(lock).catch(() => {}); };
}

export async function singleStudioStatus(id: string) {
  const file = await fileForCard(id);
  if (!file) return null;
  const [ready, lock, candidate, failure] = await Promise.all(["", ".lock", ".preview", ".error"].map(suffix => fileStat(file + suffix)));
  return { version: path.basename(file), ready: Boolean(ready), generating: Boolean(lock && Date.now() - lock.mtimeMs < lockTimeout),
    candidate: candidate ? String(candidate.mtimeMs) : null, failure: failure ? await readFile(file + ".error", "utf8").catch(() => "") || "generation" : null, hasKey: hasStudioKey() };
}

export async function reviewStudioImage(id: string, version: string, candidate: string, adopt: boolean) {
  const file = await fileForCard(id);
  if (!file || path.basename(file) !== version) throw new Error("首图已更改，请刷新后重试。");
  const unlock = await lockStudioFile(file);
  try {
    const preview = file + ".preview";
    const current = await fileStat(preview);
    if (!current || String(current.mtimeMs) !== candidate) throw new Error("预览已更新，请刷新后重试。");
    if (adopt) {
      await rename(preview, file);
      await removeStudioFile(path.join(getThumbnailsDir(), "studio", path.basename(file) + ".webp"));
    } else await unlink(preview);
  } finally { await unlock(); }
}

export async function readStudioPreview(name: string, candidate: boolean) {
  if (!name.endsWith(".png") || name !== path.basename(name) || /[\\/:]/.test(name) || [...name].some(char => char.charCodeAt(0) < 32)) return null;
  const file = path.join(directory(), name + (candidate ? ".preview" : ""));
  const entry = await lstat(file).catch(() => null);
  if (!entry?.isFile() || path.dirname(await realpath(file)) !== await realpath(directory())) return null;
  return readFile(file);
}

export async function generateStudioImage(id: string, previewVersion?: string) {
  const card = await prisma.card.findUnique({ where: { id }, select });
  if (!card || !card.images.length) throw new Error("卡牌没有可用的正面图。");
  const file = studioFile(card)!;
  if (previewVersion && previewVersion !== path.basename(file)) throw new Error("首图已更改，请刷新后重试。");
  if (!previewVersion && await existingStudioFile(card)) return;
  await mkdir(directory(), { recursive: true });
  const unlock = await lockStudioFile(file);
  const temp = file + "." + randomUUID() + ".tmp";
  try {
    if (previewVersion ? await fileStat(file + ".preview") : await existingStudioFile(card)) return;
    const settings = getStudioAiSettings();
    if (!settings.apiKey) throw new Error("请先在设置中保存 OpenAI API Key。");
    const front = card.images[0];
    if (!/^\/media\/[\w.-]+\.(?:webp|jpe?g|png)$/i.test(front.path)) throw new Error("无法读取卡牌正面图。");
    const oriented = await sharp(path.join(getUploadsDir(), path.basename(front.path))).autoOrient().toBuffer();
    const photo = await sharp(oriented).rotate(front.rotation).resize({ width: 2048, height: 2048, fit: "inside", withoutEnlargement: true }).png().toBuffer({ resolveWithObject: true });
    const direction = oversized(card) ? { rotation: 0, layout: "portrait" as const } : await inspectStudioOrientation(photo.data, settings);
    const frontPng = direction?.rotation ? await sharp(photo.data).rotate(direction.rotation).png().toBuffer() : photo.data;
    const form = new FormData();
    form.set("model", "gpt-image-2");
    form.set("size", "1088x1456");
    form.set("quality", "high");
    form.set("output_format", "png");
    form.set("n", "1");
    form.set("prompt", [
      "Rephotograph the exact physical card in image one. All subsequent images are references only for studio lighting, support and framing. Inspect the PLAYER, NAME and TYPOGRAPHY printed on the INNER card to establish upright and its native orientation, independently of input file dimensions and the grading label. Rotate the ENTIRE slab and label together. Present landscape card faces horizontally, even when that makes the PSA/BGS label sideways on the left or right. Never rearrange the inner card relative to its holder.",
      direction ? "The source has been oriented for the printed card. Keep the complete object " + (direction.layout === "landscape" ? "HORIZONTAL, with its long side along the tabletop." : "VERTICAL on its short side.") : "Choose the matching reference by the printed card orientation.",
      "One front-facing portrait 3:4 studio photograph. Match the appropriate reference staging. Physically relight the card, foil and rigid clear case under the same diffused warm upper-left window light as the pale grey wall and ivory plinth. Restore clear transmission through the case, subtle edge refraction, coherent specular highlights and soft rightward cast shadows; include contact occlusion at the support. Remove source scanner background and old glare. Preserve printed artwork, serial numbers, signatures, grades, labels, material texture, geometry and the owner's exact physical example. Never substitute the reference cards.",
      card.gradingCompany?.trim() || card.grade?.trim()
        ? "Retain the authentic grading slab and its certificate, matching the source exactly."
        : "For an ungraded standard-size card, replace any sleeve, black or tinted frame, screw-down or nonstandard holder with a plain colorless transparent two-piece magnetic one-touch. Show one round metal magnet centered on a short edge and the studio through the clear perimeter. Do not invent a grading label. If the source visibly contains an authentic labeled grading slab, preserve it even if the grading fields were left blank.",
      "Frame landscape holders at about 88 percent of the portrait image width, with the whole stand in view. For die-cut openings, show the real studio behind the card through the clear holder; retain opaque black print.",
      oversized(card) ? "Oversized collectible exception: preserve its original oversized enclosure directly on the plinth. Do not fit a standard one-touch. NO stand, easel or support." : "Set the card on the same small clear acrylic display stand as the reference."
    ].join(" "));
    form.append("image[]", new Blob([new Uint8Array(frontPng)], { type: "image/png" }), "card-front.png");
    for (const example of direction ? [direction.layout] : ["portrait", "landscape"]) {
      const reference = await readFile(path.join(process.cwd(), "public", "studio-style", example + ".png"));
      form.append("image[]", new Blob([new Uint8Array(reference)], { type: "image/png" }), example + "-reference.png");
    }
    const reply = await fetchAi("https://api.openai.com/v1/images/edits", { method: "POST", headers: { Authorization: "Bearer " + settings.apiKey }, body: form, redirect: "error", signal: AbortSignal.timeout(360000) }, settings.proxy);
    if (!reply.ok) { await reply.body?.cancel(); throw new Error("OpenAI 图片生成失败（HTTP " + reply.status + "）。请检查密钥、模型权限和额度。"); }
    const encoded = (await reply.json()).data?.[0]?.b64_json;
    if (typeof encoded !== "string" || !encoded.length) throw new Error("OpenAI 未返回图片。");
    const png = await sharp(Buffer.from(encoded, "base64")).png().toBuffer();
    await writeFile(temp, png);
    const destination = previewVersion ? file + ".preview" : file;
    await rename(temp, destination);
    await removeStudioFile(file + ".error");
    // Another edit may have retired this upload while the external request was running.
    const current = await prisma.cardImage.findUnique({ where: { id: front.id }, select: { path: true } });
    if (current?.path !== front.path) await removeStudioFile(destination);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const reason = message.includes("API Key") ? "key" : message.includes("HTTP 429") ? "quota"
      : /HTTP 40[13]/.test(message) ? "access" : "generation";
    await writeFile(file + ".error", reason).catch(() => {});
    throw error;
  } finally {
    await unlock();
    await unlink(temp).catch(() => {});
  }
}
