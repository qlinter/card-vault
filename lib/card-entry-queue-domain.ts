import type {
  CardRecognitionConfidence,
  CardRecognitionSuggestion
} from "./card-recognition-domain.ts";

export const cardEntryQueuePairingModes = ["pairs", "single"] as const;
export type CardEntryQueuePairingMode = (typeof cardEntryQueuePairingModes)[number];

export const maxCardEntryBatchImages = 20;
export const maxCardEntryBatchBytes = 100 * 1024 * 1024;
export const maxCardEntryQueueItemsShown = 40;

export type CardEntryQueueImageSummary = {
  id: string;
  originalName: string;
  url?: string;
  side: "front" | "back";
  sortOrder: number;
  originalBytes: number;
  processedBytes?: number;
  width?: number;
  height?: number;
};

export type CardEntryRecognitionSummary = {
  status: "recognizing" | "review" | "failed";
  attemptCount: number;
  suggestion?: CardRecognitionSuggestion;
  confidence?: CardRecognitionConfidence;
  lowConfidenceFields: string[];
  errorMessage?: string;
  updatedAt: string;
};

export type CardEntryQueueItemSummary = {
  id: string;
  batchId: string;
  batchLabel: string;
  status: "processing" | "ready" | "failed";
  attemptCount: number;
  errorMessage?: string;
  createdAt: string;
  images: CardEntryQueueImageSummary[];
  recognition?: CardEntryRecognitionSummary;
};

export function normalizeCardEntryQueuePairingMode(
  value: unknown
): CardEntryQueuePairingMode {
  return value === "single" ? "single" : "pairs";
}

export function groupCardEntryBatchFiles<T>(
  files: T[],
  pairingMode: CardEntryQueuePairingMode
): T[][] {
  const groupSize = pairingMode === "pairs" ? 2 : 1;
  const groups: T[][] = [];
  for (let index = 0; index < files.length; index += groupSize) {
    groups.push(files.slice(index, index + groupSize));
  }
  return groups;
}

export function cardEntryQueueSide(index: number): "front" | "back" {
  return index === 0 ? "front" : "back";
}

export function normalizeCardEntryBatchLabel(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().slice(0, 120);
  return normalized || null;
}
