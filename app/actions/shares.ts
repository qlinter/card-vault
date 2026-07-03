"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { exportShareCollection, ShareExportMode } from "@/lib/share-export";

function toOptionalString(value: FormDataEntryValue | null): string | null {
  if (!value || typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function slugify(value: string): string {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "share";
}

async function uniqueSlug(title: string, existingId?: string): Promise<string> {
  const base = slugify(title);
  let candidate = base;
  let index = 2;

  while (true) {
    const existing = await prisma.shareCollection.findUnique({ where: { slug: candidate } });
    if (!existing || existing.id === existingId) {
      return candidate;
    }

    candidate = `${base}-${index}`;
    index += 1;
  }
}

function selectedCardIds(formData: FormData): string[] {
  const seen = new Set<string>();
  return formData
    .getAll("cardIds")
    .map((value) => String(value).trim())
    .filter((value) => {
      if (!value || seen.has(value)) {
        return false;
      }
      seen.add(value);
      return true;
    });
}

function collectionData(formData: FormData) {
  const title = toOptionalString(formData.get("title"));
  if (!title) {
    throw new Error("请填写分享集标题。");
  }

  return {
    title,
    subtitle: toOptionalString(formData.get("subtitle")),
    description: toOptionalString(formData.get("description")),
    themeNarrative: toOptionalString(formData.get("themeNarrative")),
    themeHighlights: toOptionalString(formData.get("themeHighlights")),
    groupNotes: toOptionalString(formData.get("groupNotes")),
    coverImagePath: toOptionalString(formData.get("coverImagePath"))
  };
}

function itemData(cardIds: string[], formData: FormData) {
  return cardIds
    .map((cardId, index) => {
      const sortValue = Number.parseInt(String(formData.get(`sortOrder-${cardId}`) ?? ""), 10);
      return {
        cardId,
        sortOrder: Number.isFinite(sortValue) ? sortValue : index,
        displayTitle: toOptionalString(formData.get(`displayTitle-${cardId}`)),
        displayDescription: toOptionalString(formData.get(`displayDescription-${cardId}`))
      };
    })
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function createShareCollectionAction(formData: FormData): Promise<void> {
  let redirectPath = "/shares/new?error=unknown";

  try {
    const data = collectionData(formData);
    const cardIds = selectedCardIds(formData);
    if (cardIds.length === 0) {
      throw new Error("请至少选择一张卡片。");
    }

    const slug = await uniqueSlug(data.title);
    const share = await prisma.shareCollection.create({
      data: {
        ...data,
        slug,
        items: {
          create: itemData(cardIds, formData)
        }
      }
    });

    revalidatePath("/shares");
    redirectPath = `/shares/${share.id}/edit?success=created`;
  } catch (error) {
    const message = error instanceof Error ? error.message : "创建分享集失败，请稍后重试。";
    redirectPath = `/shares/new?error=${encodeURIComponent(message)}`;
  }

  redirect(redirectPath);
}

export async function updateShareCollectionAction(shareId: string, formData: FormData): Promise<void> {
  let redirectPath = `/shares/${shareId}/edit?error=unknown`;

  try {
    const existing = await prisma.shareCollection.findUnique({ where: { id: shareId } });
    if (!existing) {
      throw new Error("分享集不存在或已删除。");
    }

    const data = collectionData(formData);
    const cardIds = selectedCardIds(formData);
    if (cardIds.length === 0) {
      throw new Error("请至少选择一张卡片。");
    }

    const slug = await uniqueSlug(data.title, shareId);
    await prisma.$transaction(async (transaction) => {
      await transaction.shareCollection.update({
        where: { id: shareId },
        data: { ...data, slug }
      });
      await transaction.shareCollectionItem.deleteMany({ where: { shareCollectionId: shareId } });
      await transaction.shareCollectionItem.createMany({
        data: itemData(cardIds, formData).map((item) => ({ ...item, shareCollectionId: shareId }))
      });
    });

    revalidatePath("/shares");
    revalidatePath(`/shares/${shareId}/edit`);
    revalidatePath(`/shares/${shareId}/preview`);
    revalidatePath(`/shares/${shareId}/export`);
    redirectPath = `/shares/${shareId}/edit?success=updated`;
  } catch (error) {
    const message = error instanceof Error ? error.message : "更新分享集失败，请稍后重试。";
    redirectPath = `/shares/${shareId}/edit?error=${encodeURIComponent(message)}`;
  }

  redirect(redirectPath);
}

export async function deleteShareCollectionAction(shareId: string): Promise<void> {
  let redirectPath = "/shares?success=deleted";

  try {
    await prisma.shareCollection.delete({ where: { id: shareId } });
    revalidatePath("/shares");
  } catch (error) {
    const message = error instanceof Error ? error.message : "删除分享集失败，请稍后重试。";
    redirectPath = `/shares?error=${encodeURIComponent(message)}`;
  }

  redirect(redirectPath);
}

export async function exportShareCollectionAction(shareId: string, mode: ShareExportMode): Promise<void> {
  let redirectPath = `/shares/${shareId}/export?error=unknown`;

  try {
    const collection = await prisma.shareCollection.findUnique({
      where: { id: shareId },
      include: {
        items: {
          include: { card: { include: { images: { orderBy: { createdAt: "asc" } } } } },
          orderBy: { sortOrder: "asc" }
        }
      }
    });

    if (!collection) {
      throw new Error("分享集不存在或已删除。");
    }
    if (collection.items.length === 0) {
      throw new Error("分享集没有选中的卡片。");
    }

    const result = await exportShareCollection(collection, mode);
    redirectPath = `/shares/${shareId}/export?success=${mode}&path=${encodeURIComponent(result.folderPath)}&zip=${encodeURIComponent(result.zipPath)}&cards=${result.cardCount}&images=${result.imageCount}`;
  } catch (error) {
    const message = error instanceof Error ? error.message : "导出失败，请稍后重试。";
    redirectPath = `/shares/${shareId}/export?error=${encodeURIComponent(message)}`;
  }

  redirect(redirectPath);
}
