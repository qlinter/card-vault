import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import type { CardEntryQueueImage, Prisma } from "@prisma/client";
import {
  cardEntryQueueSide,
  groupCardEntryBatchFiles,
  maxCardEntryBatchBytes,
  maxCardEntryBatchImages,
  maxCardEntryQueueItemsShown,
  normalizeCardEntryBatchLabel,
  normalizeCardEntryQueuePairingMode,
  type CardEntryQueueItemSummary
} from "@/lib/card-entry-queue-domain";
import { errorMessage } from "@/lib/feedback-messages";
import { prepareImageUpload } from "@/lib/image-upload";
import { prisma } from "@/lib/prisma";
import { getEntryQueueDir, getUploadsDir } from "@/lib/storage-paths";
import {
  recoverInterruptedCardEntryRecognitions,
  summarizeCardEntryRecognition
} from "@/lib/card-entry-recognition-service";

const entryQueueDir = getEntryQueueDir();
const uploadsDir = getUploadsDir();
const maxProcessedEdge = 2400;
const processedWebpQuality = 88;

type QueueItemWithRelations = Prisma.CardEntryQueueItemGetPayload<{
  include: { batch: true; images: true; recognition: true };
}>;

function safeOriginalName(value: string): string {
  return path.basename(value || "image").slice(0, 240) || "image";
}

function managedFilePath(directory: string, value: string): string {
  return path.join(directory, path.basename(value));
}

async function removeManagedFile(directory: string, value?: string | null) {
  if (!value) return;
  try {
    await unlink(managedFilePath(directory, value));
  } catch {
    // Missing queue files are reported by retry/health checks; cleanup remains idempotent.
  }
}

async function saveQueueSource(imageId: string, file: File): Promise<string> {
  const prepared = await prepareImageUpload(file, `图片 ${safeOriginalName(file.name)}`);
  await mkdir(entryQueueDir, { recursive: true });
  const fileName = `${imageId}-${randomUUID()}.${prepared.extension}`;
  await writeFile(managedFilePath(entryQueueDir, fileName), prepared.buffer);
  return fileName;
}

async function preprocessQueueSource(sourcePath: string) {
  await mkdir(uploadsDir, { recursive: true });
  const fileName = `${Date.now()}-${randomUUID()}.webp`;
  const outputPath = managedFilePath(uploadsDir, fileName);
  const { data, info } = await sharp(managedFilePath(entryQueueDir, sourcePath), {
    failOn: "error",
    limitInputPixels: 80_000_000
  })
    .rotate()
    .resize({
      width: maxProcessedEdge,
      height: maxProcessedEdge,
      fit: "inside",
      withoutEnlargement: true
    })
    .webp({ quality: processedWebpQuality, effort: 4, smartSubsample: true })
    .toBuffer({ resolveWithObject: true });
  await writeFile(outputPath, data);
  return {
    publicPath: `/media/${fileName}`,
    processedBytes: info.size,
    width: info.width,
    height: info.height
  };
}

async function markQueueItemFailed(itemId: string, error: unknown) {
  await prisma.cardEntryQueueItem.update({
    where: { id: itemId },
    data: {
      status: "failed",
      errorMessage: errorMessage(error, "图片预处理失败。").slice(0, 500)
    }
  });
}

async function processQueueItem(
  itemId: string,
  initialFiles?: File[],
  alreadyClaimed = false
) {
  const outputPaths: string[] = [];

  try {
    if (!alreadyClaimed) {
      await prisma.cardEntryQueueItem.update({
        where: { id: itemId },
        data: {
          status: "processing",
          errorMessage: null,
          attemptCount: { increment: 1 }
        }
      });
    }

    const initialItem = await prisma.cardEntryQueueItem.findUniqueOrThrow({
      where: { id: itemId },
      include: { images: { orderBy: { sortOrder: "asc" } } }
    });

    if (initialFiles) {
      for (const [index, image] of initialItem.images.entries()) {
        const file = initialFiles[index];
        if (!file) throw new Error(`${image.originalName} 缺少对应源图。`);
        const sourcePath = await saveQueueSource(image.id, file);
        await prisma.cardEntryQueueImage.update({
          where: { id: image.id },
          data: { sourcePath }
        });
      }
    }

    const images = await prisma.cardEntryQueueImage.findMany({
      where: { itemId },
      orderBy: { sortOrder: "asc" }
    });
    const processed: Array<{
      image: CardEntryQueueImage;
      result: Awaited<ReturnType<typeof preprocessQueueSource>>;
    }> = [];
    for (const image of images) {
      if (!image.sourcePath) {
        throw new Error(`${image.originalName} 缺少可重试源图，请移除后重新导入。`);
      }
      const result = await preprocessQueueSource(image.sourcePath);
      outputPaths.push(result.publicPath);
      processed.push({ image, result });
    }

    await prisma.$transaction(async (transaction) => {
      for (const { image, result } of processed) {
        await transaction.cardEntryQueueImage.update({
          where: { id: image.id },
          data: {
            sourcePath: null,
            processedPath: result.publicPath,
            processedBytes: result.processedBytes,
            width: result.width,
            height: result.height
          }
        });
      }
      await transaction.cardEntryQueueItem.update({
        where: { id: itemId },
        data: { status: "ready", errorMessage: null }
      });
    });

    await Promise.all(
      processed.map(({ image }) =>
        removeManagedFile(entryQueueDir, image.sourcePath)
      )
    );
  } catch (error) {
    await Promise.all(
      outputPaths.map((value) => removeManagedFile(uploadsDir, value))
    );
    await markQueueItemFailed(itemId, error);
  }
}

export async function createCardEntryImageBatch(input: {
  files: File[];
  pairingMode: unknown;
  label?: unknown;
}) {
  const files = input.files.filter((file) => file.size > 0);
  if (files.length < 1) throw new Error("请至少选择 1 张图片。");
  if (files.length > maxCardEntryBatchImages) {
    throw new Error(`单次最多导入 ${maxCardEntryBatchImages} 张图片。`);
  }
  const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
  if (totalBytes > maxCardEntryBatchBytes) {
    throw new Error("单次导入图片总大小不能超过 100MB。");
  }

  const pairingMode = normalizeCardEntryQueuePairingMode(input.pairingMode);
  const groups = groupCardEntryBatchFiles(files, pairingMode);
  const batch = await prisma.cardEntryBatch.create({
    data: {
      label: normalizeCardEntryBatchLabel(input.label),
      pairingMode,
      items: {
        create: groups.map((group, itemIndex) => ({
          status: "processing",
          sortOrder: itemIndex,
          images: {
            create: group.map((file, imageIndex) => ({
              originalName: safeOriginalName(file.name),
              side: cardEntryQueueSide(imageIndex),
              sortOrder: imageIndex,
              mimeType: file.type || "application/octet-stream",
              originalBytes: file.size
            }))
          }
        }))
      }
    },
    include: { items: { orderBy: { sortOrder: "asc" } } }
  });

  for (const [index, item] of batch.items.entries()) {
    await processQueueItem(item.id, groups[index]);
  }

  const counts = await prisma.cardEntryQueueItem.groupBy({
    by: ["status"],
    where: { batchId: batch.id },
    _count: { _all: true }
  });
  return {
    batchId: batch.id,
    pairingMode,
    itemCount: groups.length,
    readyCount: counts.find((row) => row.status === "ready")?._count._all ?? 0,
    failedCount: counts.find((row) => row.status === "failed")?._count._all ?? 0
  };
}

export async function retryCardEntryQueueItem(id: string) {
  const claimed = await prisma.cardEntryQueueItem.updateMany({
    where: { id, status: "failed" },
    data: {
      status: "processing",
      errorMessage: null,
      attemptCount: { increment: 1 }
    }
  });
  if (claimed.count === 0) {
    const exists = await prisma.cardEntryQueueItem.count({ where: { id } });
    if (exists === 0) throw new Error("待处理项不存在或已完成。");
    throw new Error("只有失败项目可以重试。");
  }
  await processQueueItem(id, undefined, true);
  return prisma.cardEntryQueueItem.findUniqueOrThrow({ where: { id } });
}

export async function swapCardEntryQueueItemImages(id: string) {
  const item = await prisma.cardEntryQueueItem.findUnique({
    where: { id },
    include: { images: { orderBy: { sortOrder: "asc" } } }
  });
  if (!item || item.status !== "ready") throw new Error("待处理项尚未准备完成。");
  if (item.images.length !== 2) throw new Error("只有正反面双图项目可以交换顺序。");

  await prisma.$transaction([
    prisma.cardEntryQueueImage.update({
      where: { id: item.images[0].id },
      data: { sortOrder: 1, side: "back" }
    }),
    prisma.cardEntryQueueImage.update({
      where: { id: item.images[1].id },
      data: { sortOrder: 0, side: "front" }
    })
  ]);
}

export async function deleteCardEntryQueueItem(id: string) {
  const item = await prisma.cardEntryQueueItem.findUnique({
    where: { id },
    include: { images: true }
  });
  if (!item) return;

  await prisma.$transaction(async (transaction) => {
    await transaction.cardEntryQueueItem.delete({ where: { id } });
    const remaining = await transaction.cardEntryQueueItem.count({
      where: { batchId: item.batchId }
    });
    if (remaining === 0) {
      await transaction.cardEntryBatch.delete({ where: { id: item.batchId } });
    }
  });
  await Promise.all(
    item.images.flatMap((image) => [
      removeManagedFile(entryQueueDir, image.sourcePath),
      removeManagedFile(uploadsDir, image.processedPath)
    ])
  );
}

function summarizeQueueItem(item: QueueItemWithRelations): CardEntryQueueItemSummary {
  return {
    id: item.id,
    batchId: item.batchId,
    batchLabel: item.batch.label || "未命名批次",
    status: item.status as CardEntryQueueItemSummary["status"],
    attemptCount: item.attemptCount,
    errorMessage: item.errorMessage ?? undefined,
    createdAt: item.createdAt.toISOString(),
    images: [...item.images]
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .map((image) => ({
        id: image.id,
        originalName: image.originalName,
        url: image.processedPath ?? undefined,
        side: image.side === "back" ? "back" : "front",
        sortOrder: image.sortOrder,
        originalBytes: image.originalBytes,
        processedBytes: image.processedBytes ?? undefined,
        width: image.width ?? undefined,
        height: image.height ?? undefined
      })),
    recognition: item.recognition
      ? summarizeCardEntryRecognition(item.recognition)
      : undefined
  };
}

async function recoverInterruptedQueueItems() {
  const interruptedBefore = new Date(Date.now() - 30 * 60 * 1000);
  await prisma.cardEntryQueueItem.updateMany({
    where: {
      status: "processing",
      updatedAt: { lt: interruptedBefore }
    },
    data: {
      status: "failed",
      errorMessage: "上次图片处理被中断，请重试。"
    }
  });
}

export async function listCardEntryQueueItems(
  limit = maxCardEntryQueueItemsShown
): Promise<CardEntryQueueItemSummary[]> {
  await recoverInterruptedQueueItems();
  await recoverInterruptedCardEntryRecognitions();
  const items = await prisma.cardEntryQueueItem.findMany({
    where: { status: { in: ["processing", "ready", "failed"] } },
    orderBy: [{ createdAt: "asc" }, { sortOrder: "asc" }],
    take: Math.max(1, Math.min(limit, maxCardEntryQueueItemsShown)),
    include: { batch: true, images: true, recognition: true }
  });
  return items.map(summarizeQueueItem);
}

export async function getCardEntryQueueItemSummary(
  id: string
): Promise<CardEntryQueueItemSummary | null> {
  await recoverInterruptedQueueItems();
  await recoverInterruptedCardEntryRecognitions();
  const item = await prisma.cardEntryQueueItem.findUnique({
    where: { id },
    include: { batch: true, images: true, recognition: true }
  });
  return item ? summarizeQueueItem(item) : null;
}

export async function getNextReadyCardEntryQueueItemId(): Promise<string | undefined> {
  const item = await prisma.cardEntryQueueItem.findFirst({
    where: { status: "ready" },
    orderBy: [{ createdAt: "asc" }, { sortOrder: "asc" }],
    select: { id: true }
  });
  return item?.id;
}

export async function getReadyCardEntryQueueNavigation(id: string): Promise<{
  previousId?: string;
  nextId?: string;
}> {
  const items = await prisma.cardEntryQueueItem.findMany({
    where: { status: "ready" },
    orderBy: [{ createdAt: "asc" }, { sortOrder: "asc" }],
    select: { id: true }
  });
  const index = items.findIndex((item) => item.id === id);
  if (index < 0) return {};
  return {
    previousId: items[index - 1]?.id,
    nextId: items[index + 1]?.id
  };
}
