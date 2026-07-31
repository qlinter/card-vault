"use server";

import { randomUUID } from "crypto";
import { mkdir, unlink, writeFile } from "fs/promises";
import path from "path";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { parseTags } from "@/lib/card-helpers";
import { CardFormValues } from "@/lib/card-form-values";
import { prepareImageUpload } from "@/lib/image-upload";
import { prisma } from "@/lib/prisma";
import { getUploadsDir } from "@/lib/storage-paths";

const uploadDir = getUploadsDir();
const maxImagesPerCard = 5;

export type CreateCardFormState = {
  error?: string;
  values: CardFormValues;
};

function toImagePublicPath(fileName: string): string {
  return `/media/${fileName}`;
}

function toOptionalString(value: FormDataEntryValue | null): string | null {
  if (!value || typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toOptionalFloat(value: FormDataEntryValue | null): number | null {
  const raw = toOptionalString(value);
  if (!raw) {
    return null;
  }

  const normalized = raw.replace(/[¥￥\s]/g, "");
  if (!normalized) {
    return null;
  }

  const numberValue = Number.parseFloat(normalized);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function calculateTotalCost(purchasePrice: number | null, gradingFee: number | null): number | null {
  if (purchasePrice === null && gradingFee === null) {
    return null;
  }

  return (purchasePrice ?? 0) + (gradingFee ?? 0);
}

function toOptionalDate(value: FormDataEntryValue | null): Date | null {
  const raw = toOptionalString(value);
  if (!raw) {
    return null;
  }

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseBoolean(formData: FormData, field: string): boolean {
  return formData.get(field) === "on";
}

function getCreateCardValues(formData: FormData): CardFormValues {
  const getString = (field: keyof CardFormValues) => {
    const value = formData.get(field);
    return typeof value === "string" ? value : "";
  };

  return {
    playerName: getString("playerName"),
    cardTitle: getString("cardTitle"),
    sport: getString("sport"),
    team: getString("team"),
    year: getString("year"),
    brand: getString("brand"),
    productLine: getString("productLine"),
    subsetName: getString("subsetName"),
    parallel: getString("parallel"),
    cardNumber: getString("cardNumber"),
    serialNumber: getString("serialNumber"),
    serialRange: getString("serialRange"),
    gradingCompany: getString("gradingCompany"),
    grade: getString("grade"),
    certNumber: getString("certNumber"),
    gradingLink: getString("gradingLink"),
    visibility: getString("visibility") || "private",
    collectionStatus: getString("collectionStatus") || "holding",
    purchaseDate: getString("purchaseDate"),
    purchasePrice: getString("purchasePrice"),
    gradingFee: getString("gradingFee"),
    totalCost: getString("totalCost"),
    currentValue: getString("currentValue"),
    purchaseSource: getString("purchaseSource"),
    tags: getString("tags"),
    publicDescription: getString("publicDescription"),
    notes: getString("notes"),
    isRookie: parseBoolean(formData, "isRookie"),
    isAutograph: parseBoolean(formData, "isAutograph"),
    autoType: getString("autoType"),
    isPatch: parseBoolean(formData, "isPatch"),
    patchType: getString("patchType")
  };
}

function ensureBaseFields(formData: FormData): { playerName: string; cardTitle: string; sport: string } {
  const playerName = toOptionalString(formData.get("playerName"));
  const cardTitle = toOptionalString(formData.get("cardTitle"));
  const sport = toOptionalString(formData.get("sport"));

  if (!playerName || !cardTitle || !sport) {
    throw new Error("球员姓名、卡片名称、运动类型是必填项。");
  }

  return { playerName, cardTitle, sport };
}

function buildCardData(formData: FormData, isSerialNumbered: boolean) {
  const { playerName, cardTitle, sport } = ensureBaseFields(formData);
  const purchasePrice = toOptionalFloat(formData.get("purchasePrice"));
  const gradingFee = toOptionalFloat(formData.get("gradingFee"));
  const tagsRaw = toOptionalString(formData.get("tags"));

  return {
    playerName,
    cardTitle,
    sport,
    team: toOptionalString(formData.get("team")),
    year: toOptionalString(formData.get("year")),
    brand: toOptionalString(formData.get("brand")),
    productLine: toOptionalString(formData.get("productLine")),
    subsetName: toOptionalString(formData.get("subsetName")),
    parallel: toOptionalString(formData.get("parallel")),
    cardNumber: toOptionalString(formData.get("cardNumber")),
    isSerialNumbered,
    serialNumber: toOptionalString(formData.get("serialNumber")),
    serialRange: toOptionalString(formData.get("serialRange")),
    isRookie: parseBoolean(formData, "isRookie"),
    isAutograph: parseBoolean(formData, "isAutograph"),
    autoType: toOptionalString(formData.get("autoType")),
    isPatch: parseBoolean(formData, "isPatch"),
    patchType: toOptionalString(formData.get("patchType")),
    gradingCompany: toOptionalString(formData.get("gradingCompany")),
    grade: toOptionalString(formData.get("grade")),
    certNumber: toOptionalString(formData.get("certNumber")),
    gradingLink: toOptionalString(formData.get("gradingLink")),
    visibility: toOptionalString(formData.get("visibility")) ?? "private",
    collectionStatus: toOptionalString(formData.get("collectionStatus")) ?? "holding",
    purchaseDate: toOptionalDate(formData.get("purchaseDate")),
    purchasePrice,
    gradingFee,
    totalCost: calculateTotalCost(purchasePrice, gradingFee),
    currentValue: toOptionalFloat(formData.get("currentValue")),
    purchaseSource: toOptionalString(formData.get("purchaseSource")),
    tags: tagsRaw ? parseTags(tagsRaw).join(",") : null,
    publicDescription: toOptionalString(formData.get("publicDescription")),
    notes: toOptionalString(formData.get("notes"))
  };
}

async function saveUploads(files: File[]): Promise<string[]> {
  const preparedFiles = await Promise.all(files.map((file) => prepareImageUpload(file, "卡片图片")));
  await mkdir(uploadDir, { recursive: true });
  const imagePaths: string[] = [];

  try {
    for (const prepared of preparedFiles) {
      const fileName = `${Date.now()}-${randomUUID()}.${prepared.extension}`;
      await writeFile(path.join(uploadDir, fileName), prepared.buffer);
      imagePaths.push(toImagePublicPath(fileName));
    }
    return imagePaths;
  } catch (error) {
    await Promise.all(imagePaths.map((imagePath) => removeImageIfExists(imagePath)));
    throw error;
  }
}

async function removeImageIfExists(relativePath: string): Promise<void> {
  const fileName = path.basename(relativePath);
  const fullPath = path.join(uploadDir, fileName);

  try {
    await unlink(fullPath);
  } catch {
    // 图片文件可能已经被手动移除，忽略即可。
  }
}

export async function createCardFormAction(
  _previousState: CreateCardFormState,
  formData: FormData
): Promise<CreateCardFormState> {
  let redirectPath: string | null = null;
  let imagePaths: string[] = [];

  try {
    const cardData = buildCardData(formData, false);
    const files = formData.getAll("images").filter((entry): entry is File => entry instanceof File && entry.size > 0);

    if (files.length < 1) {
      throw new Error("至少上传 1 张图片。");
    }
    if (files.length > maxImagesPerCard) {
      throw new Error(`最多上传 ${maxImagesPerCard} 张图片。`);
    }

    imagePaths = await saveUploads(files);
    const card = await prisma.card.create({
      data: {
        ...cardData,
        images: {
          create: imagePaths.map((pathValue) => ({ path: pathValue }))
        }
      }
    });
    imagePaths = [];

    revalidatePath("/");
    revalidatePath("/showcase");
    redirectPath = `/cards/${card.id}?success=created`;
  } catch (error) {
    await Promise.all(imagePaths.map((imagePath) => removeImageIfExists(imagePath)));
    return {
      error: error instanceof Error ? error.message : "创建失败，请稍后重试。",
      values: getCreateCardValues(formData)
    };
  }

  redirect(redirectPath);
}

export async function updateCardAction(cardId: string, formData: FormData): Promise<void> {
  let redirectPath = `/cards/${cardId}/edit?error=unknown`;

  try {
    const existing = await prisma.card.findUnique({
      where: { id: cardId },
      include: { images: true }
    });

    if (!existing) {
      throw new Error("卡片不存在或已删除。");
    }

    const cardData = buildCardData(formData, existing.isSerialNumbered);
    const removeImageIds = formData.getAll("removeImageIds").map((value) => String(value));
    const files = formData.getAll("images").filter((entry): entry is File => entry instanceof File && entry.size > 0);

    const imagesToRemove = existing.images.filter((image) => removeImageIds.includes(image.id));
    const remainingCount = existing.images.length - imagesToRemove.length + files.length;

    if (remainingCount < 1) {
      throw new Error("至少保留 1 张图片。");
    }
    if (remainingCount > maxImagesPerCard) {
      throw new Error(`最多保留 ${maxImagesPerCard} 张图片。`);
    }

    const imagePaths = await saveUploads(files);
    try {
      await prisma.$transaction(async (transaction) => {
        await transaction.card.update({
          where: { id: cardId },
          data: cardData
        });

        if (imagesToRemove.length > 0) {
          await transaction.cardImage.deleteMany({
            where: { id: { in: imagesToRemove.map((image) => image.id) } }
          });
        }

        if (imagePaths.length > 0) {
          await transaction.cardImage.createMany({
            data: imagePaths.map((pathValue) => ({ cardId, path: pathValue }))
          });
        }
      });
    } catch (error) {
      await Promise.all(imagePaths.map((imagePath) => removeImageIfExists(imagePath)));
      throw error;
    }

    await Promise.all(imagesToRemove.map((image) => removeImageIfExists(image.path)));

    revalidatePath("/");
    revalidatePath(`/cards/${cardId}`);
    revalidatePath("/showcase");
    revalidatePath(`/showcase/cards/${cardId}`);
    redirectPath = `/cards/${cardId}?success=updated`;
  } catch (error) {
    const message = error instanceof Error ? error.message : "更新失败，请稍后重试。";
    redirectPath = `/cards/${cardId}/edit?error=${encodeURIComponent(message)}`;
  }

  redirect(redirectPath);
}

export async function deleteCardAction(cardId: string): Promise<void> {
  let redirectPath = "/?error=unknown";

  try {
    const existing = await prisma.card.findUnique({
      where: { id: cardId },
      include: { images: true }
    });

    if (!existing) {
      throw new Error("卡片不存在或已删除。");
    }

    await prisma.card.delete({ where: { id: cardId } });
    await Promise.all(existing.images.map((image) => removeImageIfExists(image.path)));

    revalidatePath("/");
    revalidatePath("/showcase");
    redirectPath = "/?success=deleted";
  } catch (error) {
    const message = error instanceof Error ? error.message : "删除失败，请稍后重试。";
    redirectPath = `/?error=${encodeURIComponent(message)}`;
  }

  redirect(redirectPath);
}


