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

export type CardEntryDraftSummary = {
  id: string;
  title: string;
  updatedAt: string;
};

export async function saveCardEntryDraft(input: {
  id?: string;
  values: unknown;
}) {
  const id = input.id ? normalizeCardEntryId(input.id) : undefined;
  if (input.id && !id) throw new Error("草稿编号无效。");
  const values = normalizeCardFormValues(input.values);
  const data = {
    schemaVersion: cardEntryDraftSchemaVersion,
    status: "draft",
    valuesJson: serializeCardEntryDraftValues(values)
  };

  if (id) {
    const updated = await prisma.cardEntryDraft.updateMany({
      where: { id, status: "draft" },
      data
    });
    if (updated.count > 0) {
      return prisma.cardEntryDraft.findUniqueOrThrow({ where: { id } });
    }
    throw new Error("草稿已完成或已删除，请刷新录入页。");
  }
  return prisma.cardEntryDraft.create({ data });
}

export async function getCardEntryDraft(
  id: string
): Promise<{ id: string; values: CardFormValues } | null> {
  const normalizedId = normalizeCardEntryId(id);
  if (!normalizedId) return null;
  const draft = await prisma.cardEntryDraft.findFirst({
    where: {
      id: normalizedId,
      status: "draft",
      schemaVersion: cardEntryDraftSchemaVersion
    }
  });
  return draft ? { id: draft.id, values: parseCardEntryDraftValues(draft.valuesJson) } : null;
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
  await prisma.cardEntryDraft.deleteMany({
    where: { id: normalizedId, status: "draft" }
  });
}
