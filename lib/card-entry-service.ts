import type { Prisma } from "@prisma/client";
import type { CardFormValues } from "@/lib/card-form-values";
import { buildCardData } from "@/lib/card-entry-domain";
import {
  maxImagesPerCard,
  removeCardImageIfExists,
  saveCardUploads
} from "@/lib/card-media-service";
import { optionalCardDate } from "@/lib/card-domain";
import { normalizeCurrency } from "@/lib/financial-history";
import { deriveLegacyFinancialSnapshot } from "@/lib/financial-history-snapshot";
import {
  createCardExpense,
  createCardTransaction,
  createCardValuation,
  getCardFinancialHistory
} from "@/lib/financial-history-store";
import { prisma } from "@/lib/prisma";

function optionalString(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

async function createInitialFinancialHistory(
  transaction: Prisma.TransactionClient,
  cardId: string,
  values: CardFormValues,
  gradingCompany: string | null
) {
  const purchaseAmount = optionalString(values.purchasePrice);
  const gradingAmount = optionalString(values.gradingFee);
  const valuationAmount = optionalString(values.currentValue);
  const purchaseDate = optionalCardDate(values.purchaseDate, "购买日期");
  const valuationDate = optionalCardDate(values.valuationDate, "估值日期");
  const currency = normalizeCurrency(optionalString(values.historyCurrency));
  const valuationSource = optionalString(values.valuationSource);

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
      source: optionalString(values.purchaseSource),
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
  await transaction.card.update({
    where: { id: cardId },
    data: deriveLegacyFinancialSnapshot(history)
  });
}

export async function createCardEntry(input: {
  values: CardFormValues;
  files: File[];
  draftId?: string;
  queueItemId?: string;
}) {
  const { values, files, draftId, queueItemId } = input;
  const cardData = buildCardData(values);
  const queuedItem = queueItemId
    ? await prisma.cardEntryQueueItem.findFirst({
        where: { id: queueItemId, status: "ready" },
        include: { images: { orderBy: { sortOrder: "asc" } } }
      })
    : null;
  if (queueItemId && !queuedItem) {
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
  try {
    const card = await prisma.$transaction(async (transaction) => {
      const transactionQueueItem = queueItemId
        ? await transaction.cardEntryQueueItem.findFirst({
            where: { id: queueItemId, status: "ready" },
            include: { images: { orderBy: { sortOrder: "asc" } } }
          })
        : null;
      if (queueItemId && !transactionQueueItem) {
        throw new Error("队列项目已在其他录入流程中处理。");
      }
      const transactionQueuePaths = transactionQueueItem?.images.map((image) => {
        if (!image.processedPath) throw new Error("队列项目缺少预处理图片。");
        return image.processedPath;
      }) ?? [];
      const created = await transaction.card.create({
        data: {
          ...cardData,
          images: {
            create: [...transactionQueuePaths, ...imagePaths].map((pathValue) => ({
              path: pathValue
            }))
          }
        }
      });
      await createInitialFinancialHistory(transaction, created.id, values, cardData.gradingCompany);
      if (draftId) await transaction.cardEntryDraft.deleteMany({ where: { id: draftId } });
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
    return { card, usedQueueItemId: queueItemId };
  } finally {
    await Promise.all(imagePaths.map((imagePath) => removeCardImageIfExists(imagePath)));
  }
}
