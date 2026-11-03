import type { CardFormValues } from "@/lib/card-form-values";
import type { CardImageRotation } from "@/lib/card-image-rotation";
import { buildCardData } from "@/lib/card-entry-domain";
import { parseInitialCardQuantity } from "@/lib/card-quantity";
import {
  maxImagesPerCard,
  removeCardImageIfExists,
  saveCardUploads
} from "@/lib/card-media-service";
import { prisma } from "@/lib/prisma";
import { createInitialFinancialHistory } from "@/lib/card-entry-finance-service";
import { readDraftImages, type DraftImage } from "./card-entry-draft-images.js";
import { cardIdForSubmission } from "./card-write-guards";

export async function createCardEntry(input: {
  submissionId: string;
  values: CardFormValues;
  files: File[];
  newImageRotations?: CardImageRotation[];
  queuedImageRotations?: Record<string, CardImageRotation>;
  draftId?: string;
  queueItemId?: string;
}) {
  const { submissionId, values, files, newImageRotations = [], queuedImageRotations = {}, draftId, queueItemId } = input;
  const cardId = cardIdForSubmission(submissionId, draftId, queueItemId);
  const previous = await prisma.card.findUnique({ where: { id: cardId } });
  if (previous) return { card: previous, usedQueueItemId: queueItemId };
  const cardData = buildCardData(values);
  const initialQuantity = parseInitialCardQuantity(values.initialQuantity, cardData.collectionStatus);
  const queuedItem = queueItemId
    ? await prisma.cardEntryQueueItem.findFirst({
        where: { id: queueItemId, status: "ready" },
        include: { images: { orderBy: { sortOrder: "asc" } } }
      })
    : null;
  if (queueItemId && !queuedItem) {
    const committed = await prisma.card.findUnique({ where: { id: cardId } });
    if (committed) return { card: committed, usedQueueItemId: queueItemId };
    throw new Error("队列项目不存在、尚未准备完成或已经被处理。");
  }
  const queuedPaths = queuedItem?.images.flatMap((image) =>
    image.processedPath ? [image.processedPath] : []
  ) ?? [];
  if (queuedItem && queuedPaths.length !== queuedItem.images.length) {
    throw new Error("队列项目缺少预处理图片，请重试或重新导入。");
  }
  const totalImageCount = queuedPaths.length + files.length;
  if (totalImageCount < 1) throw new Error("至少上传 1 张图片。");
  if (totalImageCount > maxImagesPerCard) {
    throw new Error(`最多上传 ${maxImagesPerCard} 张图片。`);
  }

  let imagePaths = await saveCardUploads(files);
  let completedDraftImages: DraftImage[] = [];
  try {
    const card = await prisma.$transaction(async (transaction) => {
      // Reserve the unique submission identity before reading/consuming a queue or draft.
      // SQLite serializes this write; a losing retry returns the committed card below.
      const created = await transaction.card.create({ data: { id: cardId, ...cardData, holdingQuantity: initialQuantity } });
      const transactionQueueItem = queueItemId
        ? await transaction.cardEntryQueueItem.findFirst({
            where: { id: queueItemId, status: "ready" },
            include: { images: { orderBy: { sortOrder: "asc" } } }
          })
        : null;
      if (queueItemId && !transactionQueueItem) {
        throw new Error("队列项目已在其他录入流程中处理。");
      }
      const transactionQueueImages = transactionQueueItem?.images.map((image) => {
        if (!image.processedPath) throw new Error("队列项目缺少预处理图片。");
        return {
          path: image.processedPath,
          rotation: queuedImageRotations[image.id] ?? 0
        };
      }) ?? [];
      await transaction.cardImage.createMany({ data: [
        ...transactionQueueImages,
        ...imagePaths.map((pathValue, index) => ({ path: pathValue, rotation: newImageRotations[index] ?? 0 }))
      ].map(image => ({ cardId, ...image })) });
      await createInitialFinancialHistory(
        transaction,
        created.id,
        values,
        cardData.gradingCompany,
        initialQuantity
      );
      if (draftId) {
        const draft = await transaction.cardEntryDraft.findUnique({ where: { id: draftId } });
        completedDraftImages = draft ? readDraftImages(draft.valuesJson) : [];
        await transaction.cardEntryDraft.deleteMany({ where: { id: draftId } });
      }
      if (transactionQueueItem) {
        await transaction.cardEntryQueueItem.delete({
          where: { id: transactionQueueItem.id }
        });
        const remaining = await transaction.cardEntryQueueItem.count({
          where: { batchId: transactionQueueItem.batchId }
        });
        if (remaining === 0) {
          await transaction.cardEntryBatch.delete({
            where: { id: transactionQueueItem.batchId }
          });
        }
      }
      return created;
    });
    imagePaths = [];
    await Promise.all(completedDraftImages.map(image => removeCardImageIfExists(image.path)));
    return { card, usedQueueItemId: queueItemId };
  } catch (error) {
    // Another request can have committed while this request was preparing its images.
    const committed = await prisma.card.findUnique({ where: { id: cardId } });
    if (committed) return { card: committed, usedQueueItemId: queueItemId };
    throw error;
  } finally {
    await Promise.all(imagePaths.map((imagePath) => removeCardImageIfExists(imagePath)));
  }
}
