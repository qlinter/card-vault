"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { CardFormValues } from "@/lib/card-form-values";
import {
  buildCardData,
  normalizeCardEntryId,
  readCardEntrySaveIntent,
  readCardFormValues
} from "@/lib/card-entry-domain";
import { createCardEntry } from "@/lib/card-entry-service";
import { getNextReadyCardEntryQueueItemId } from "@/lib/card-entry-queue-service";
import {
  maxImagesPerCard,
  readCardImageFiles,
  removeCardImageIfExists,
  saveCardUploads
} from "@/lib/card-media-service";
import { prisma } from "@/lib/prisma";
import { errorMessage } from "@/lib/feedback-messages";
import { normalizeReturnTo } from "@/lib/query-params";

export type CreateCardFormState = {
  error?: string;
  values: CardFormValues;
};

export async function createCardFormAction(
  _previousState: CreateCardFormState,
  formData: FormData
): Promise<CreateCardFormState> {
  let redirectPath: string | null = null;
  const values = readCardFormValues(formData);
  const saveIntent = readCardEntrySaveIntent(formData);
  const draftId = normalizeCardEntryId(formData.get("draftId"));
  const queueItemId = normalizeCardEntryId(formData.get("queueItemId"));

  try {
    const { card, usedQueueItemId } = await createCardEntry({
      values,
      files: readCardImageFiles(formData),
      draftId,
      queueItemId
    });
    let nextQueueItemId: string | undefined;
    if (usedQueueItemId) {
      try {
        nextQueueItemId = await getNextReadyCardEntryQueueItemId();
      } catch {
        // The card is already committed; queue lookup failure must not invite a duplicate resubmission.
      }
    }

    revalidatePath("/");
    revalidatePath("/showcase");
    revalidatePath("/cards/new");
    if (saveIntent === "view") {
      redirectPath = `/cards/${card.id}?success=created`;
    } else {
      const params = new URLSearchParams({ success: "created" });
      if (saveIntent === "copy") params.set("copyFrom", card.id);
      if (nextQueueItemId) params.set("queue", nextQueueItemId);
      redirectPath = `/cards/new?${params.toString()}`;
    }
  } catch (error) {
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
    const files = readCardImageFiles(formData);

    const imagesToRemove = existing.images.filter((image) => removeImageIds.includes(image.id));
    const remainingCount = existing.images.length - imagesToRemove.length + files.length;

    if (remainingCount < 1) {
      throw new Error("至少保留 1 张图片。");
    }
    if (remainingCount > maxImagesPerCard) {
      throw new Error(`最多保留 ${maxImagesPerCard} 张图片。`);
    }

    const imagePaths = await saveCardUploads(files);
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
      await Promise.all(imagePaths.map((imagePath) => removeCardImageIfExists(imagePath)));
      throw error;
    }

    await Promise.all(imagesToRemove.map((image) => removeCardImageIfExists(image.path)));

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
    await Promise.all(existing.images.map((image) => removeCardImageIfExists(image.path)));

    revalidatePath("/");
    revalidatePath("/showcase");
    redirectPath = "/?success=deleted";
  } catch (error) {
    const message = errorMessage(error, "删除失败，请稍后重试。");
    redirectPath = `/?error=${encodeURIComponent(message)}`;
  }

  redirect(redirectPath);
}
