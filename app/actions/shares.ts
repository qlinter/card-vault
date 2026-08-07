"use server";

import { randomUUID } from "crypto";
import { mkdir, unlink, writeFile } from "fs/promises";
import path from "path";
import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prepareImageUpload } from "@/lib/image-upload";
import { prisma } from "@/lib/prisma";
import { exportShareCollection, ShareExportMode } from "@/lib/share-export";
import { getShareBackgroundsDir, getShareCoversDir } from "@/lib/storage-paths";
import { createSharePresentation, serializeSharePresentation } from "@/lib/share-presentation";
import { parseShareSectionDrafts } from "@/lib/share-sections";
import { normalizeShareTheme } from "@/lib/share-themes";

const shareCoverDir = getShareCoversDir();
const shareBackgroundDir = getShareBackgroundsDir();
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

function toShareCoverPublicPath(fileName: string): string {
  return `/share-covers/${fileName}`;
}

function toShareBackgroundPublicPath(fileName: string): string {
  return `/share-backgrounds/${fileName}`;
}

async function saveCoverUpload(file: File): Promise<string> {
  const prepared = await prepareImageUpload(file, "分享封面");
  await mkdir(shareCoverDir, { recursive: true });
  const fileName = `share-cover-${Date.now()}-${randomUUID()}.${prepared.extension}`;
  const fullPath = path.join(shareCoverDir, fileName);
  await writeFile(fullPath, prepared.buffer);
  return toShareCoverPublicPath(fileName);
}

async function saveBackgroundUpload(file: File): Promise<string> {
  const prepared = await prepareImageUpload(file, "分享背景");
  await mkdir(shareBackgroundDir, { recursive: true });
  const fileName = `share-background-${Date.now()}-${randomUUID()}.${prepared.extension}`;
  const fullPath = path.join(shareBackgroundDir, fileName);
  await writeFile(fullPath, prepared.buffer);
  return toShareBackgroundPublicPath(fileName);
}

async function removeManagedShareImage(imagePath: string | null): Promise<void> {
  if (!imagePath) {
    return;
  }

  const targetDir = imagePath.startsWith("/share-covers/")
    ? shareCoverDir
    : imagePath.startsWith("/share-backgrounds/")
      ? shareBackgroundDir
      : null;
  if (!targetDir) {
    return;
  }

  try {
    await unlink(path.join(targetDir, path.basename(imagePath)));
  } catch {
    // Missing files do not need to block share collection updates.
  }
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

async function collectionData(formData: FormData) {
  const title = toOptionalString(formData.get("title"));
  if (!title) {
    throw new Error("请填写分享集标题。");
  }

  const uploadedPaths: string[] = [];
  try {
    const coverMode = toOptionalString(formData.get("coverMode")) ?? "auto";
    const coverUpload = formData.get("coverImage");
    let coverImagePath =
      coverMode === "custom" ? toOptionalString(formData.get("existingCoverImagePath")) : null;
    if (coverMode === "custom" && coverUpload instanceof File && coverUpload.size > 0) {
      coverImagePath = await saveCoverUpload(coverUpload);
      uploadedPaths.push(coverImagePath);
    }

    const backgroundUpload = formData.get("backgroundImage");
    let backgroundImagePath =
      formData.get("clearBackgroundImage") === "on"
        ? null
        : toOptionalString(formData.get("existingBackgroundImagePath"));
    if (backgroundUpload instanceof File && backgroundUpload.size > 0) {
      backgroundImagePath = await saveBackgroundUpload(backgroundUpload);
      uploadedPaths.push(backgroundImagePath);
    }

    return {
      data: {
        title,
        theme: normalizeShareTheme(formData.get("theme")),
        presentationConfig: serializeSharePresentation(
          createSharePresentation({
            layout: formData.get("layout"),
            backgroundPositionX: formData.get("backgroundPositionX"),
            backgroundPositionY: formData.get("backgroundPositionY"),
            panelOpacity: formData.get("panelOpacity")
          })
        ),
        subtitle: toOptionalString(formData.get("subtitle")),
        description: toOptionalString(formData.get("description")),
        themeNarrative: toOptionalString(formData.get("themeNarrative")),
        themeHighlights: toOptionalString(formData.get("themeHighlights")),
        groupNotes: toOptionalString(formData.get("groupNotes")),
        coverImagePath,
        backgroundImagePath
      },
      uploadedPaths
    };
  } catch (error) {
    await Promise.all(uploadedPaths.map((imagePath) => removeManagedShareImage(imagePath)));
    throw error;
  }
}

function itemData(cardIds: string[], formData: FormData) {
  return cardIds
    .map((cardId, index) => {
      const sortValue = Number.parseInt(String(formData.get(`sortOrder-${cardId}`) ?? ""), 10);
      return {
        cardId,
        sortOrder: Number.isFinite(sortValue) && sortValue > 0 ? sortValue : index,
        displayTitle: toOptionalString(formData.get(`displayTitle-${cardId}`)),
        displayDescription: toOptionalString(formData.get(`displayDescription-${cardId}`))
      };
    })
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

async function createShareStructure(
  transaction: Prisma.TransactionClient,
  shareCollectionId: string,
  cardIds: string[],
  formData: FormData
): Promise<void> {
  await transaction.shareCollectionItem.createMany({
    data: itemData(cardIds, formData).map((item) => ({ ...item, shareCollectionId }))
  });

  const sections = parseShareSectionDrafts(formData.get("sectionsJson"), cardIds);
  for (const [index, section] of sections.entries()) {
    const created = await transaction.shareSection.create({
      data: {
        id: randomUUID(),
        shareCollectionId,
        title: section.title,
        description: section.description || null,
        layout: section.layout,
        sortOrder: index
      }
    });
    if (section.cardIds.length > 0) {
      await transaction.shareCollectionItem.updateMany({
        where: { shareCollectionId, cardId: { in: section.cardIds } },
        data: { sectionId: created.id }
      });
    }
  }
}

export async function createShareCollectionAction(formData: FormData): Promise<void> {
  let redirectPath = "/shares/new?error=unknown";
  let uploadedPaths: string[] = [];

  try {
    const cardIds = selectedCardIds(formData);
    if (cardIds.length === 0) {
      throw new Error("请至少选择一张卡片。");
    }

    const collection = await collectionData(formData);
    const data = collection.data;
    uploadedPaths = collection.uploadedPaths;
    const slug = await uniqueSlug(data.title);
    await prisma.$transaction(async (transaction) => {
      const created = await transaction.shareCollection.create({ data: { ...data, slug } });
      await createShareStructure(transaction, created.id, cardIds, formData);
    });
    uploadedPaths = [];

    revalidatePath("/shares");
    redirectPath = "/shares?success=created";
  } catch (error) {
    await Promise.all(uploadedPaths.map((imagePath) => removeManagedShareImage(imagePath)));
    const message = error instanceof Error ? error.message : "创建分享集失败，请稍后重试。";
    redirectPath = `/shares/new?error=${encodeURIComponent(message)}`;
  }

  redirect(redirectPath);
}

export async function updateShareCollectionAction(shareId: string, formData: FormData): Promise<void> {
  let redirectPath = `/shares/${shareId}/edit?error=unknown`;
  let uploadedPaths: string[] = [];

  try {
    const existing = await prisma.shareCollection.findUnique({ where: { id: shareId } });
    if (!existing) {
      throw new Error("分享集不存在或已删除。");
    }

    const cardIds = selectedCardIds(formData);
    if (cardIds.length === 0) {
      throw new Error("请至少选择一张卡片。");
    }

    const collection = await collectionData(formData);
    const data = collection.data;
    uploadedPaths = collection.uploadedPaths;
    const slug = await uniqueSlug(data.title, shareId);
    await prisma.$transaction(async (transaction) => {
      await transaction.shareCollection.update({
        where: { id: shareId },
        data: { ...data, slug }
      });
      await transaction.shareCollectionItem.deleteMany({ where: { shareCollectionId: shareId } });
      await transaction.shareSection.deleteMany({ where: { shareCollectionId: shareId } });
      await createShareStructure(transaction, shareId, cardIds, formData);
    });
    uploadedPaths = [];

    const replacedPaths = [
      existing.coverImagePath !== data.coverImagePath ? existing.coverImagePath : null,
      existing.backgroundImagePath !== data.backgroundImagePath ? existing.backgroundImagePath : null
    ].filter((imagePath): imagePath is string => Boolean(imagePath));
    await Promise.all(replacedPaths.map((imagePath) => removeManagedShareImage(imagePath)));

    revalidatePath("/shares");
    revalidatePath(`/shares/${shareId}/edit`);
    revalidatePath(`/shares/${shareId}/preview`);
    revalidatePath(`/shares/${shareId}/export`);
    redirectPath = "/shares?success=updated";
  } catch (error) {
    await Promise.all(uploadedPaths.map((imagePath) => removeManagedShareImage(imagePath)));
    const message = error instanceof Error ? error.message : "更新分享集失败，请稍后重试。";
    redirectPath = `/shares/${shareId}/edit?error=${encodeURIComponent(message)}`;
  }

  redirect(redirectPath);
}

export async function deleteShareCollectionAction(shareId: string): Promise<void> {
  let redirectPath = "/shares?success=deleted";

  try {
    const existing = await prisma.shareCollection.findUnique({ where: { id: shareId } });
    if (!existing) {
      throw new Error("分享集不存在或已删除。");
    }
    await prisma.shareCollection.delete({ where: { id: shareId } });
    await Promise.all(
      [existing.coverImagePath, existing.backgroundImagePath].map((imagePath) => removeManagedShareImage(imagePath))
    );
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
        sections: { orderBy: { sortOrder: "asc" } },
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
