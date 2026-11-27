import type { Prisma } from "@prisma/client";
import { assertDraftVersion, draftVersion } from "./card-write-guards";
import {
  cardEntryDraftSchemaVersion,
  cardEntryDraftTitle,
  normalizeCardEntryId,
  normalizeCardFormValues,
  parseCardEntryDraftValues,
  serializeCardEntryDraftValues
} from "@/lib/card-entry-domain";
import { prisma } from "@/lib/prisma";
import { parseEntryFinance } from "@/lib/card-entry-finance";
import { readDraftImages, type DraftImage } from "./card-entry-draft-images.js";
import { saveCardUploads, removeCardImageIfExists } from "./card-media-service";
import { cardImageSelectionError } from "./card-image-limits.js";
import { normalizeCardImageRotation, parseCardImageRotations } from "./card-image-rotation";

export type CardEntryDraftSummary = {
  id: string;
  title: string;
  version: string;
  updatedAt: string;
};

function draftSummary(draft: { id: string; valuesJson: string; updatedAt: Date }): CardEntryDraftSummary {
  return { id: draft.id, version: draftVersion(draft.valuesJson), title: cardEntryDraftTitle(parseCardEntryDraftValues(draft.valuesJson)), updatedAt: draft.updatedAt.toISOString() };
}

export async function draftImageContext(client: Pick<Prisma.TransactionClient, "cardEntryQueueImage">, json: string) {
  let data: {frontChoice?: unknown; queueItemId?: unknown; queuedImageRotations?: unknown};
  try { data = JSON.parse(json) ?? {}; } catch { data = {}; }
  const frontChoice: string | undefined = typeof data.frontChoice === "string" ? data.frontChoice : undefined;
  let queueItemId = normalizeCardEntryId(data.queueItemId);
  // Earlier queue drafts may identify the source only through the selected front.
  const queuedFront = frontChoice?.startsWith("queued:") ? frontChoice.slice(7) : undefined;
  if (!queueItemId && queuedFront) {
    const image = await client.cardEntryQueueImage.findUnique({ where: { id: queuedFront }, select: { itemId: true } });
    queueItemId = image?.itemId;
  }
  return { frontChoice, queueItemId, missingQueue: Boolean(queuedFront && !queueItemId), queuedImageRotations: parseCardImageRotations(data.queuedImageRotations ?? {}) };
}

export async function saveCardEntryDraft(input: {
  id?: string;
  expectedVersion?: unknown;
  queueItemId?: unknown;
  queuedImageRotations?: unknown;
  values: unknown;
  images?: File[];
  imageRotations?: unknown;
  frontChoice?: unknown;
}) {
  const id = input.id ? normalizeCardEntryId(input.id) : undefined;
  if (input.id && !id) throw new Error("草稿编号无效。");
  const requestedQueue = normalizeCardEntryId(input.queueItemId);
  if (input.queueItemId != null && !requestedQueue) throw new Error("队列编号无效。");
  const values = normalizeCardFormValues(input.values);
  // Reject an invalid draft explicitly instead of accepting JSON that cannot be restored.
  parseEntryFinance(values.financialRecords);
  const data = {
    schemaVersion: cardEntryDraftSchemaVersion,
    status: "draft",
    valuesJson: serializeCardEntryDraftValues(values)
  };

  const error = input.images ? cardImageSelectionError(input.images) : "";
  if (error) throw new Error(error);
  const uploaded = input.images ? await saveCardUploads(input.images, "draft-") : undefined;
  let previous: DraftImage[] = [];
  try {
    const saved = await prisma.$transaction(async tx => {
      const current = id ? await tx.cardEntryDraft.findFirst({ where: { id, status: "draft" } }) : null;
      if (id) assertDraftVersion(current, input.expectedVersion);
      previous = current ? readDraftImages(current.valuesJson) : [];
      const rotations = Array.isArray(input.imageRotations) ? input.imageRotations : undefined;
      const images = uploaded ? uploaded.map((path, index) => ({ path, name: input.images![index].name, rotation: normalizeCardImageRotation(rotations?.[index]) }))
        : previous.map((image, index) => ({ ...image, rotation: rotations ? normalizeCardImageRotation(rotations[index]) : image.rotation }));
      const context = current ? await draftImageContext(tx, current.valuesJson) : undefined;
      if (context?.missingQueue || (requestedQueue && context?.queueItemId && requestedQueue !== context.queueItemId)) throw new Error("草稿关联的队列项目已变化，请重新打开草稿。");
      const queueItemId = context?.queueItemId ?? requestedQueue;
      const queuedImageRotations = queueItemId ? parseCardImageRotations(input.queuedImageRotations ?? context?.queuedImageRotations ?? {}) : undefined;
      const frontChoice = typeof input.frontChoice === "string" ? input.frontChoice.slice(0, 140) : context?.frontChoice;
      const merged = { ...data, valuesJson: JSON.stringify({ ...JSON.parse(data.valuesJson), frontChoice, draftImages: images, queueItemId, queuedImageRotations }) };
      return current ? tx.cardEntryDraft.update({ where: { id: current.id }, data: merged }) : tx.cardEntryDraft.create({ data: merged });
    });
    if (uploaded) await Promise.all(previous.map(image => removeCardImageIfExists(image.path)));
    return { id: saved.id, version: draftVersion(saved.valuesJson), updatedAt: saved.updatedAt.toISOString() };
  } catch (error) {
    if (uploaded) await Promise.all(uploaded.map(removeCardImageIfExists));
    throw error;
  }
}

export async function getCardEntryDraft(
  id: string
) {
  const normalizedId = normalizeCardEntryId(id);
  if (!normalizedId) return null;
  const draft = await prisma.cardEntryDraft.findFirst({
    where: {
      id: normalizedId,
      status: "draft",
      schemaVersion: cardEntryDraftSchemaVersion
    }
  });
  return draft ? { id: draft.id, version: draftVersion(draft.valuesJson), values: parseCardEntryDraftValues(draft.valuesJson), ...await draftImageContext(prisma, draft.valuesJson), images: readDraftImages(draft.valuesJson) } : null;
}

export async function getQueueDraft(queueItemId: string) {
  const [latest] = await prisma.$queryRaw<{id: string}[]>`
    SELECT id FROM CardEntryDraft WHERE status='draft' AND schemaVersion=${cardEntryDraftSchemaVersion}
    AND CASE WHEN json_valid(valuesJson) THEN COALESCE(json_extract(valuesJson,'$.queueItemId'),
      CASE WHEN json_extract(valuesJson,'$.frontChoice') LIKE 'queued:%' THEN
        (SELECT itemId FROM CardEntryQueueImage WHERE id = substr(json_extract(CardEntryDraft.valuesJson,'$.frontChoice'),8)) END) END = ${queueItemId}
    ORDER BY updatedAt DESC, id DESC LIMIT 1`;
  return latest ? getCardEntryDraft(latest.id) : null;
}

export async function listRecentCardEntryDrafts(limit = 8): Promise<CardEntryDraftSummary[]> {
  const drafts = await prisma.cardEntryDraft.findMany({
    where: { status: "draft", schemaVersion: cardEntryDraftSchemaVersion },
    orderBy: { updatedAt: "desc" },
    take: Math.max(1, Math.min(limit, 20))
  });
  return drafts.map(draftSummary);
}

export async function deleteCardEntryDraft(id: string, expectedVersion: string | null) {
  const normalizedId = normalizeCardEntryId(id);
  if (!normalizedId) throw new Error("草稿编号无效。");
  const result = await prisma.$transaction(async tx => {
    const draft = await tx.cardEntryDraft.findFirst({ where: { id: normalizedId, status: "draft" } });
    if (!draft) return { deleted: true, images: [] } as const;
    const latest = draftSummary(draft);
    if (expectedVersion !== latest.version) return { deleted: false, latest } as const;
    await tx.cardEntryDraft.delete({ where: { id: normalizedId } });
    return { deleted: true, images: readDraftImages(draft.valuesJson) } as const;
  });
  if (!result.deleted) return result;
  await Promise.all(result.images.map(image => removeCardImageIfExists(image.path)));
  return { deleted: true } as const;
}
