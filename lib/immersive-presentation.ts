import type { RecapSpec } from "./collection-recap.ts";
import { showcaseFacts } from "./showcase-presentation.ts";

export type GallerySource = { q?: string; group?: string; spec?: RecapSpec; ids?: string[] };
export type GalleryCard = {
  id: string; playerName: string; cardTitle: string; collectionStatus: string;
  year?: string | null; brand?: string | null; productLine?: string | null;
  parallel?: string | null; gradingCompany?: string | null; grade?: string | null;
  serialNumber?: string | null; serialRange?: string | null;
  images: { id: string; path: string; rotation: number }[];
};

// New scenes can extend this registry without changing playback or collection data.
export const galleryScenes = {
  spotlight: { label: "暗室聚光" },
  whitebox: { label: "白盒美术馆" },
  archive: { label: "暖纸典藏" },
  moonlight: { label: "月光展厅" }
} as const;
export const galleryPreferenceKey = "card-vault-gallery-presentation-v1";
export type GalleryPreferences = {
  scene: keyof typeof galleryScenes;
  layout: "exhibition" | "focus";
  artScale: number;
  light: number;
  captions: boolean;
  interval: number;
  allImages: boolean;
  random: boolean;
};
export const defaultGalleryPreferences: GalleryPreferences = {
  scene: "spotlight", layout: "exhibition", artScale: 92, light: 65, captions: true, interval: 8, allImages: false, random: false
};
export function normalizeGalleryPreferences(value: unknown): GalleryPreferences {
  const raw = value && typeof value === "object" ? value as Partial<GalleryPreferences> : {};
  const percentage = (candidate: unknown, fallback: number, min: number) => typeof candidate === "number" && Number.isFinite(candidate) ? Math.max(min, Math.min(100, Math.round(candidate))) : fallback;
  return {
    scene: raw.scene && Object.hasOwn(galleryScenes, raw.scene) ? raw.scene : "spotlight",
    layout: raw.layout === "focus" ? "focus" : "exhibition",
    artScale: percentage(raw.artScale, defaultGalleryPreferences.artScale, 60),
    light: percentage(raw.light, defaultGalleryPreferences.light, 0),
    captions: typeof raw.captions === "boolean" ? raw.captions : true,
    interval: typeof raw.interval === "number" && Number.isFinite(raw.interval) ? Math.max(1, Math.min(3600, Math.round(raw.interval))) : 8,
    allImages: typeof raw.allImages === "boolean" ? raw.allImages : false,
    random: typeof raw.random === "boolean" ? raw.random : false
  };
}
export function galleryPosition(index = 0, count = 0) {
  return { current: count ? index % count + 1 : 0, total: count, round: count ? Math.floor(index / count) + 1 : 1 };
}

/** Keep useful archive facts while suppressing information already in the title. */
export function galleryCaption(card: GalleryCard) {
  const normalized = (value: string) => value.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  const title = card.cardTitle.trim();
  const subject = normalized(card.playerName);
  const subtitle = normalized(title) === subject ? "" : title;
  const shown = ` ${normalized(`${card.playerName} ${subtitle}`)} `;
  const alreadyShown = (value: string) => shown.includes(` ${normalized(value)} `);
  return {
    subtitle,
    year: card.year && !alreadyShown(card.year) ? card.year : undefined,
    facts: showcaseFacts(card).filter(fact => ["系列", "版本", "评级", "限量编号"].includes(fact.label) && !alreadyShown(fact.value))
  };
}
