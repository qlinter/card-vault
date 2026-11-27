import { randomUUID, createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import type { Stats } from "node:fs";
import path from "node:path";
import { writeJsonAtomic } from "./atomic-json.js";
import { lockStudioFile } from "./studio-file-lock.ts";
import type { Box } from "./group-photo-geometry.ts";

export function validCrop(value: unknown): value is Box {
  if (!value || typeof value !== "object") return false;
  const {x, y, w, h} = value as Box;
  return [x, y, w, h].every(Number.isFinite) && x >= 0 && y >= 0 && w >= .05 - Number.EPSILON && h >= .05 - Number.EPSILON &&
    x + w <= 1.000001 && y + h <= 1.000001;
}

export function studioAssetVersion(file: string, stats: Stats) {
  return [path.basename(file), stats.size, stats.mtimeMs, stats.ctimeMs].join(":");
}
const digest = (data: Buffer) => createHash("sha256").update(data).digest("hex");

async function readMetadata(file: string) {
  try {
    const text = await readFile(file, "utf8");
    try { return {text, data: JSON.parse(text)}; }
    catch (error) { if (error instanceof SyntaxError) return {text, data:null}; throw error; }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return {text:null, data:null};
    throw error;
  }
}

async function readCrop(file: string) {
  const {text, data} = await readMetadata(file + ".crop.json");
  // Crops written before revisions were introduced can still participate in conflict checks.
  const revision: string = typeof data?.revision === "string" ? data.revision
    : text === null ? "none" : createHash("sha256").update(text).digest("hex");
  return {data, revision};
}

async function studioDigest(file: string, version: string) {
  const cache = path.join(path.dirname(file), "..", "thumbnails", "studio", path.basename(file) + ".digest.json");
  const cached = await readMetadata(cache).catch(() => null);
  if (cached?.data?.version === version && /^[0-9a-f]{64}$/.test(cached.data.digest)) return String(cached.data.digest);
  const hash = digest(await readFile(file));
  try { writeJsonAtomic(cache,{version,digest:hash}); } catch { /* A read-only cache still permits verification. */ }
  return hash;
}

export async function studioCropInfo(file: string | null) {
  if (!file) return null;
  try {
    const stats = await stat(file);
    if (!stats.isFile()) return null;
    const version = studioAssetVersion(file,stats);
    const {data, revision} = await readCrop(file);
    const crop: Box | null = validCrop(data?.box) && (data.version === version || data.digest === await studioDigest(file,version)) ? data.box : null;
    return {version, revision, crop};
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

export async function saveStudioCrop(file: string | null, version: string, expectedRevision: string, box: Box | null) {
  if (!file) return {status:"image-changed"} as const;
  if (box !== null && !validCrop(box)) throw new Error("Invalid crop");
  let unlock;
  try {
    unlock = await lockStudioFile(file + ".crop.json","crop-busy");
    if (studioAssetVersion(file,await stat(file)) !== version) return {status:"image-changed"} as const;
    if ((await readCrop(file)).revision !== expectedRevision) return {status:"crop-changed"} as const;
    const hash = box ? await studioDigest(file,version) : undefined;
    if (studioAssetVersion(file,await stat(file)) !== version) return {status:"image-changed"} as const;
    // Keep a revision even for automatic framing so an older editor cannot undo a reset.
    const revision = randomUUID();
    writeJsonAtomic(file + ".crop.json",{version,revision,box,digest:hash});
    return {status:"saved",revision} as const;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return {status:"image-changed"} as const;
    if (error instanceof Error && error.message === "crop-busy") return {status:"crop-busy"} as const;
    throw error;
  } finally { await unlock?.(); }
}
