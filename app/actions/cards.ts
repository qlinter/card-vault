"use server";

import { randomUUID } from "crypto";
import { mkdir, unlink, writeFile } from "fs/promises";
import path from "path";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { parseTags } from "@/lib/card-helpers";
import { CardFormValues } from "@/lib/card-form-values";
import { prisma } from "@/lib/prisma";
import { getUploadsDir } from "@/lib/storage-paths";

const uploadDir = getUploadsDir();
const validMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
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

  const normalized = raw.replace(/[¥\s]/g, "");
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
    setName: getString("setName"),
    cardNumber: getString("cardNumber"),
    serialNumber: getString("serialNumber"),
    serialRange: getString("serialRange"),
    gradingCompany: getString("gradingCompany"),
    grade: getString("grade"),
    gradingLink: getString("gradingLink"),
    purchaseDate: getString("purchaseDate"),
    purchasePrice: getString("purchasePrice"),
    gradingFee: getString("gradingFee"),
    totalCost: getString("totalCost"),
    currentValue: getString("currentValue"),
    purchaseSource: getString("purchaseSource"),
    tags: getString("tags"),
    publicDescription: getString("publicDescription"),
    notes: getString("notes"),
    isAutograph: parseBoolean(formData, "isAutograph"),
    isPatch: parseBoolean(formData, "isPatch")
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

function validateFileList(files: File[]): void {
  for (const file of files) {
    if (!validMimeTypes.has(file.type)) {
      throw new Error("仅支持 jpg、jpeg、png、webp 图片格式。");
    }
  }
}

async function saveUpload(file: File): Promise<string> {
  await mkdir(uploadDir, { recursive: true });
  const extension = file.name.includes(".") ? file.name.split(".").pop()?.toLowerCase() : "jpg";
  const fileName = `${Date.now()}-${randomUUID()}.${extension ?? "jpg"}`;
  const fullPath = path.join(uploadDir, fileName);
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(fullPath, buffer);
  return toImagePublicPath(fileName);
}

async function removeImageIfExists(relativePath: string): Promise<void> {
  const fileName = path.basename(relativePath);
  const fullPath = path.join(uploadDir, fileName);

  try {
    await unlink(fullPath);
  } catch {
    // noop
  }
}

export async function createCardAction(formData: FormData): Promise<void> {
  let redirectPath = "/cards/new?error=unknown";

  try {
    const { playerName, cardTitle, sport } = ensureBaseFields(formData);
    const files = formData.getAll("images").filter((entry): entry is File => entry instanceof File && entry.size > 0);

    if (files.length < 1) {
      throw new Error("至少上传 1 张图片。");
    }
    if (files.length > maxImagesPerCard) {
      throw new Error(`最多上传 ${maxImagesPerCard} 张图片。`);
    }

    validateFileList(files);

    const imagePaths = await Promise.all(files.map((file) => saveUpload(file)));
    const tagsRaw = toOptionalString(formData.get("tags"));

    const purchasePrice = toOptionalFloat(formData.get("purchasePrice"));
    const gradingFee = toOptionalFloat(formData.get("gradingFee"));
    const totalCost = calculateTotalCost(purchasePrice, gradingFee);

    const card = await prisma.card.create({
      data: {
        playerName,
        cardTitle,
        sport,
        team: toOptionalString(formData.get("team")),
        year: toOptionalString(formData.get("year")),
        setName: toOptionalString(formData.get("setName")),
        cardNumber: toOptionalString(formData.get("cardNumber")),
        isSerialNumbered: false,
        serialNumber: toOptionalString(formData.get("serialNumber")),
        serialRange: toOptionalString(formData.get("serialRange")),
        isAutograph: parseBoolean(formData, "isAutograph"),
        isPatch: parseBoolean(formData, "isPatch"),
        gradingCompany: toOptionalString(formData.get("gradingCompany")),
        grade: toOptionalString(formData.get("grade")),
        gradingLink: toOptionalString(formData.get("gradingLink")),
        purchaseDate: toOptionalDate(formData.get("purchaseDate")),
        purchasePrice,
        gradingFee,
        totalCost,
        currentValue: toOptionalFloat(formData.get("currentValue")),
        purchaseSource: toOptionalString(formData.get("purchaseSource")),
        tags: tagsRaw ? parseTags(tagsRaw).join(",") : null,
        publicDescription: toOptionalString(formData.get("publicDescription")),
        notes: toOptionalString(formData.get("notes")),
        images: {
          create: imagePaths.map((pathValue) => ({ path: pathValue }))
        }
      }
    });

    revalidatePath("/");
    revalidatePath("/showcase");
    redirectPath = `/cards/${card.id}?success=created`;
  } catch (error) {
    const message = error instanceof Error ? error.message : "创建失败，请稍后重试。";
    redirectPath = `/cards/new?error=${encodeURIComponent(message)}`;
  }

  redirect(redirectPath);
}

export async function createCardFormAction(
  _previousState: CreateCardFormState,
  formData: FormData
): Promise<CreateCardFormState> {
  let redirectPath: string | null = null;

  try {
    const { playerName, cardTitle, sport } = ensureBaseFields(formData);
    const files = formData.getAll("images").filter((entry): entry is File => entry instanceof File && entry.size > 0);

    if (files.length < 1) {
      throw new Error("至少上传 1 张图片。");
    }
    if (files.length > maxImagesPerCard) {
      throw new Error(`最多上传 ${maxImagesPerCard} 张图片。`);
    }

    validateFileList(files);

    const imagePaths = await Promise.all(files.map((file) => saveUpload(file)));
    const tagsRaw = toOptionalString(formData.get("tags"));

    const purchasePrice = toOptionalFloat(formData.get("purchasePrice"));
    const gradingFee = toOptionalFloat(formData.get("gradingFee"));
    const totalCost = calculateTotalCost(purchasePrice, gradingFee);

    const card = await prisma.card.create({
      data: {
        playerName,
        cardTitle,
        sport,
        team: toOptionalString(formData.get("team")),
        year: toOptionalString(formData.get("year")),
        setName: toOptionalString(formData.get("setName")),
        cardNumber: toOptionalString(formData.get("cardNumber")),
        isSerialNumbered: false,
        serialNumber: toOptionalString(formData.get("serialNumber")),
        serialRange: toOptionalString(formData.get("serialRange")),
        isAutograph: parseBoolean(formData, "isAutograph"),
        isPatch: parseBoolean(formData, "isPatch"),
        gradingCompany: toOptionalString(formData.get("gradingCompany")),
        grade: toOptionalString(formData.get("grade")),
        gradingLink: toOptionalString(formData.get("gradingLink")),
        purchaseDate: toOptionalDate(formData.get("purchaseDate")),
        purchasePrice,
        gradingFee,
        totalCost,
        currentValue: toOptionalFloat(formData.get("currentValue")),
        purchaseSource: toOptionalString(formData.get("purchaseSource")),
        tags: tagsRaw ? parseTags(tagsRaw).join(",") : null,
        publicDescription: toOptionalString(formData.get("publicDescription")),
        notes: toOptionalString(formData.get("notes")),
        images: {
          create: imagePaths.map((pathValue) => ({ path: pathValue }))
        }
      }
    });

    revalidatePath("/");
    revalidatePath("/showcase");
    redirectPath = `/cards/${card.id}?success=created`;
  } catch (error) {
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

    const { playerName, cardTitle, sport } = ensureBaseFields(formData);
    const removeImageIds = formData.getAll("removeImageIds").map((value) => String(value));
    const files = formData.getAll("images").filter((entry): entry is File => entry instanceof File && entry.size > 0);

    validateFileList(files);

    const imagesToRemove = existing.images.filter((image) => removeImageIds.includes(image.id));
    const remainingCount = existing.images.length - imagesToRemove.length + files.length;

    if (remainingCount < 1) {
      throw new Error("至少保留 1 张图片。");
    }
    if (remainingCount > maxImagesPerCard) {
      throw new Error(`最多保留 ${maxImagesPerCard} 张图片。`);
    }

    const imagePaths = await Promise.all(files.map((file) => saveUpload(file)));
    const tagsRaw = toOptionalString(formData.get("tags"));
    const purchasePrice = toOptionalFloat(formData.get("purchasePrice"));
    const gradingFee = toOptionalFloat(formData.get("gradingFee"));
    const totalCost = calculateTotalCost(purchasePrice, gradingFee);

    await prisma.$transaction(async (transaction) => {
      await transaction.card.update({
        where: { id: cardId },
        data: {
          playerName,
          cardTitle,
          sport,
          team: toOptionalString(formData.get("team")),
          year: toOptionalString(formData.get("year")),
          setName: toOptionalString(formData.get("setName")),
          cardNumber: toOptionalString(formData.get("cardNumber")),
          isSerialNumbered: existing.isSerialNumbered,
          serialNumber: toOptionalString(formData.get("serialNumber")),
          serialRange: toOptionalString(formData.get("serialRange")),
          isAutograph: parseBoolean(formData, "isAutograph"),
          isPatch: parseBoolean(formData, "isPatch"),
          gradingCompany: toOptionalString(formData.get("gradingCompany")),
          grade: toOptionalString(formData.get("grade")),
          gradingLink: toOptionalString(formData.get("gradingLink")),
          purchaseDate: toOptionalDate(formData.get("purchaseDate")),
          purchasePrice,
          gradingFee,
          totalCost,
          currentValue: toOptionalFloat(formData.get("currentValue")),
          purchaseSource: toOptionalString(formData.get("purchaseSource")),
          tags: tagsRaw ? parseTags(tagsRaw).join(",") : null,
          publicDescription: toOptionalString(formData.get("publicDescription")),
          notes: toOptionalString(formData.get("notes"))
        }
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
