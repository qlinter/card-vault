import type { CardFormValues } from "@/lib/card-form-values";
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
import { normalizeCardImageRotation } from "./card-image-rotation";

export type CardEntryDraftSummary = {
  id: string;
  title: string;
  updatedAt: string;
};

export async function saveCardEntryDraft(input: {
  id?: string;
  values: unknown;
  images?: File[];
  imageRotations?: unknown;
}) {
  const id = input.id ? normalizeCardEntryId(input.id) : undefined;
  if (input.id && !id) throw new Error("草稿编号无效。");
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
      if (id && !current) throw new Error("草稿已完成或已删除，请刷新录入页。");
      previous = current ? readDraftImages(current.valuesJson) : [];
      const rotations = Array.isArray(input.imageRotations) ? input.imageRotations : undefined;
      const images = uploaded ? uploaded.map((path, index) => ({ path, name: input.images![index].name, rotation: normalizeCardImageRotation(rotations?.[index]) }))
        : previous.map((image, index) => ({ ...image, rotation: rotations ? normalizeCardImageRotation(rotations[index]) : image.rotation }));
      const merged = { ...data, valuesJson: JSON.stringify({ ...JSON.parse(data.valuesJson), draftImages: images }) };
      return current ? tx.cardEntryDraft.update({ where: { id: current.id }, data: merged }) : tx.cardEntryDraft.create({ data: merged });
    });
    if (uploaded) await Promise.all(previous.map(image => removeCardImageIfExists(image.path)));
    return saved;
  } catch (error) {
    if (uploaded) await Promise.all(uploaded.map(removeCardImageIfExists));
    throw error;
  }
}

export async function getCardEntryDraft(
  id: string
): Promise<{ id: string; values: CardFormValues; images: DraftImage[] } | null> {
  const normalizedId = normalizeCardEntryId(id);
  if (!normalizedId) return null;
  const draft = await prisma.cardEntryDraft.findFirst({
    where: {
      id: normalizedId,
      status: "draft",
      schemaVersion: cardEntryDraftSchemaVersion
    }
  });
  return draft ? { id: draft.id, values: parseCardEntryDraftValues(draft.valuesJson), images: readDraftImages(draft.valuesJson) } : null;
}

export async function listRecentCardEntryDrafts(limit = 8): Promise<CardEntryDraftSummary[]> {
  const drafts = await prisma.cardEntryDraft.findMany({
    where: { status: "draft", schemaVersion: cardEntryDraftSchemaVersion },
    orderBy: { updatedAt: "desc" },
    take: Math.max(1, Math.min(limit, 20))
  });
  return drafts.map((draft) => ({
    id: draft.id,
    title: cardEntryDraftTitle(parseCardEntryDraftValues(draft.valuesJson)),
    updatedAt: draft.updatedAt.toISOString()
  }));
}

export async function deleteCardEntryDraft(id: string): Promise<void> {
  const normalizedId = normalizeCardEntryId(id);
  if (!normalizedId) throw new Error("草稿编号无效。");
  const images = await prisma.$transaction(async tx => {
    const draft = await tx.cardEntryDraft.findFirst({ where: { id: normalizedId, status: "draft" } });
    if (!draft) return [];
    await tx.cardEntryDraft.delete({ where: { id: normalizedId } });
    return readDraftImages(draft.valuesJson);
  });
  await Promise.all(images.map(image => removeCardImageIfExists(image.path)));
}
