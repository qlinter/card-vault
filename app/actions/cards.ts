"use server";

import { randomUUID } from "crypto";
import { mkdir, unlink, writeFile } from "fs/promises";
import path from "path";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { CardFormValues } from "@/lib/card-form-values";
import {
  cardTextLimits,
  normalizeCardCollectionStatus,
  normalizeCardTags,
  normalizeCardVisibility,
  optionalCardDate,
  optionalCardText,
  requiredCardText,
  resolveIsSerialNumbered
} from "@/lib/card-domain";
import { normalizeCurrency } from "@/lib/financial-history";
import { deriveLegacyFinancialSnapshot } from "@/lib/financial-history-snapshot";
import {
  createCardExpense,
  createCardTransaction,
  createCardValuation,
  getCardFinancialHistory
} from "@/lib/financial-history-store";
import { normalizeHttpUrl } from "@/lib/http-url";
import { prepareImageUpload } from "@/lib/image-upload";
import { prisma } from "@/lib/prisma";
import { getUploadsDir } from "@/lib/storage-paths";
import { errorMessage } from "@/lib/feedback-messages";
import { normalizeReturnTo } from "@/lib/query-params";

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

function parseBoolean(formData: FormData, field: string): boolean {
  return formData.get(field) === "on";
}

function readCardFormValues(formData: FormData): CardFormValues {
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
    isSerialNumbered: parseBoolean(formData, "isSerialNumbered"),
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
    historyCurrency: getString("historyCurrency") || "CNY",
    valuationDate: getString("valuationDate"),
    valuationSource: getString("valuationSource"),
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

function buildCardData(values: CardFormValues) {
  const serialNumber = optionalCardText(values.serialNumber, "编号");
  const serialRange = optionalCardText(values.serialRange, "编号范围");
  const gradingLinkRaw = optionalCardText(values.gradingLink, "评级链接", cardTextLimits.link);
  const gradingLink = normalizeHttpUrl(gradingLinkRaw);
  if (gradingLinkRaw && !gradingLink) {
    throw new Error("评级链接必须是有效的 http 或 https 地址。");
  }

  return {
    playerName: requiredCardText(values.playerName, "球员姓名"),
    cardTitle: requiredCardText(values.cardTitle, "卡片名称"),
    sport: requiredCardText(values.sport, "运动类型"),
    team: optionalCardText(values.team, "Team"),
    year: optionalCardText(values.year, "年份"),
    brand: optionalCardText(values.brand, "品牌"),
    productLine: optionalCardText(values.productLine, "产品线"),
    subsetName: optionalCardText(values.subsetName, "子系列"),
    parallel: optionalCardText(values.parallel, "平行版本"),
    cardNumber: optionalCardText(values.cardNumber, "卡号"),
    isSerialNumbered: resolveIsSerialNumbered({
      explicit: values.isSerialNumbered,
      serialNumber,
      serialRange
    }),
    serialNumber,
    serialRange,
    isRookie: values.isRookie,
    isAutograph: values.isAutograph,
    autoType: optionalCardText(values.autoType, "签字类型"),
    isPatch: values.isPatch,
    patchType: optionalCardText(values.patchType, "Patch 类型"),
    gradingCompany: optionalCardText(values.gradingCompany, "评级机构"),
    grade: optionalCardText(values.grade, "评级"),
    certNumber: optionalCardText(values.certNumber, "证书号"),
    gradingLink,
    visibility: normalizeCardVisibility(values.visibility),
    collectionStatus: normalizeCardCollectionStatus(values.collectionStatus),
    tags: normalizeCardTags(values.tags),
    publicDescription: optionalCardText(values.publicDescription, "展示描述", cardTextLimits.publicDescription),
    notes: optionalCardText(values.notes, "备注", cardTextLimits.notes)
  };
}

async function createInitialFinancialHistory(
  transaction: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  cardId: string,
  values: CardFormValues,
  gradingCompany: string | null
) {
  const purchaseAmount = toOptionalString(values.purchasePrice);
  const gradingAmount = toOptionalString(values.gradingFee);
  const valuationAmount = toOptionalString(values.currentValue);
  const purchaseDate = optionalCardDate(values.purchaseDate, "购买日期");
  const valuationDate = optionalCardDate(values.valuationDate, "估值日期");
  const currency = normalizeCurrency(toOptionalString(values.historyCurrency));
  const valuationSource = toOptionalString(values.valuationSource);

  if ((purchaseAmount || gradingAmount) && !purchaseDate) {
    throw new Error("填写购买价格或评级费用时，必须填写购买日期。");
  }
  if (valuationAmount && !valuationDate) {
    throw new Error("填写初始估值时，必须填写估值日期。");
  }
  if (valuationAmount && !valuationSource) {
    throw new Error("填写初始估值时，必须注明估值来源。");
  }

  if (purchaseAmount && purchaseDate) {
    await createCardTransaction(transaction, {
      cardId,
      kind: "purchase",
      amount: purchaseAmount,
      currency,
      occurredAt: purchaseDate,
      source: toOptionalString(values.purchaseSource),
      provenance: "initial_card_entry"
    });
  }
  if (gradingAmount && purchaseDate) {
    await createCardExpense(transaction, {
      cardId,
      kind: "grading",
      amount: gradingAmount,
      currency,
      occurredAt: purchaseDate,
      vendor: gradingCompany,
      provenance: "initial_card_entry"
    });
  }
  if (valuationAmount && valuationDate && valuationSource) {
    await createCardValuation(transaction, {
      cardId,
      amount: valuationAmount,
      currency,
      valuedAt: valuationDate,
      source: valuationSource,
      provenance: "initial_card_entry"
    });
  }

  const history = await getCardFinancialHistory(transaction, cardId);
  await transaction.card.update({ where: { id: cardId }, data: deriveLegacyFinancialSnapshot(history) });
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
  const values = readCardFormValues(formData);

  try {
    const cardData = buildCardData(values);
    const files = formData.getAll("images").filter((entry): entry is File => entry instanceof File && entry.size > 0);

    if (files.length < 1) {
      throw new Error("至少上传 1 张图片。");
    }
    if (files.length > maxImagesPerCard) {
      throw new Error(`最多上传 ${maxImagesPerCard} 张图片。`);
    }

    imagePaths = await saveUploads(files);
    const card = await prisma.$transaction(async (transaction) => {
      const createdCard = await transaction.card.create({
        data: {
          ...cardData,
          images: {
            create: imagePaths.map((pathValue) => ({ path: pathValue }))
          }
        }
      });
      await createInitialFinancialHistory(transaction, createdCard.id, values, cardData.gradingCompany);
      return createdCard;
    });
    imagePaths = [];

    revalidatePath("/");
    revalidatePath("/showcase");
    redirectPath = `/cards/${card.id}?success=created`;
  } catch (error) {
    await Promise.all(imagePaths.map((imagePath) => removeImageIfExists(imagePath)));
    return {
      error: errorMessage(error, "创建失败，请稍后重试。"),
      values
    };
  }

  redirect(redirectPath);
}

export async function updateCardAction(cardId: string, formData: FormData): Promise<void> {
  const rawReturnTo = formData.get("returnTo");
  const returnTo = normalizeReturnTo(typeof rawReturnTo === "string" ? rawReturnTo : undefined);
  const returnQuery = returnTo ? `&returnTo=${encodeURIComponent(returnTo)}` : "";
  let redirectPath = `/cards/${cardId}/edit?error=unknown${returnQuery}`;
  const values = readCardFormValues(formData);

  try {
    const existing = await prisma.card.findUnique({
      where: { id: cardId },
      include: { images: true }
    });

    if (!existing) {
      throw new Error("卡片不存在或已删除。");
    }

    const cardData = buildCardData(values);
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
    redirectPath = `/cards/${cardId}?success=updated${returnQuery}`;
  } catch (error) {
    const message = errorMessage(error, "更新失败，请稍后重试。");
    redirectPath = `/cards/${cardId}/edit?error=${encodeURIComponent(message)}${returnQuery}`;
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
    const message = errorMessage(error, "删除失败，请稍后重试。");
    redirectPath = `/?error=${encodeURIComponent(message)}`;
  }

  redirect(redirectPath);
}
