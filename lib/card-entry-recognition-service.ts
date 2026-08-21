import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  cardRecognitionFieldLabel,
  lowConfidenceCardRecognitionFields,
  parseStoredCardRecognition
} from "@/lib/card-recognition-domain";
import { recognizeCardImages } from "@/lib/card-recognition";
import type { CardEntryRecognitionSummary } from "@/lib/card-entry-queue-domain";
import { errorMessage } from "@/lib/feedback-messages";
import { prisma } from "@/lib/prisma";
import { getUploadsDir } from "@/lib/storage-paths";

const uploadsDir = getUploadsDir();
const maxRecognitionImageBytes = 10 * 1024 * 1024;

export function summarizeCardEntryRecognition(recognition: {
  status: string;
  suggestionJson: string | null;
  confidenceJson: string | null;
  attemptCount: number;
  errorMessage: string | null;
  updatedAt: Date;
}): CardEntryRecognitionSummary {
  const result = parseStoredCardRecognition(
    recognition.suggestionJson,
    recognition.confidenceJson
  );
  return {
    status: recognition.status === "review"
      ? "review"
      : recognition.status === "failed"
        ? "failed"
        : "recognizing",
    attemptCount: recognition.attemptCount,
    suggestion: recognition.status === "review" ? result.suggestion : undefined,
    confidence: recognition.status === "review" ? result.confidence : undefined,
    lowConfidenceFields: recognition.status === "review"
      ? lowConfidenceCardRecognitionFields(result.confidence).map(cardRecognitionFieldLabel)
      : [],
    errorMessage: recognition.errorMessage ?? undefined,
    updatedAt: recognition.updatedAt.toISOString()
  };
}

export async function recoverInterruptedCardEntryRecognitions() {
  await prisma.cardEntryRecognition.updateMany({
    where: {
      status: "recognizing",
      updatedAt: { lt: new Date(Date.now() - 5 * 60 * 1000) }
    },
    data: {
      status: "failed",
      errorMessage: "上次 AI 识别被中断，请重新识别。"
    }
  });
}

export async function recognizeCardEntryQueueItem(
  itemId: string
): Promise<CardEntryRecognitionSummary> {
  await recoverInterruptedCardEntryRecognitions();
  const item = await prisma.cardEntryQueueItem.findFirst({
    where: { id: itemId, status: "ready" },
    include: {
      images: { orderBy: { sortOrder: "asc" } },
      recognition: true
    }
  });
  if (!item) throw new Error("队列项目不存在或图片尚未准备完成。");
  if (item.recognition?.status === "recognizing") {
    throw new Error("该项目正在识别，请等待当前任务完成。");
  }
  const images = item.images.slice(0, 2);
  if (images.length < 1 || images.some((image) => !image.processedPath)) {
    throw new Error("队列项目缺少可识别的预处理图片。");
  }

  await prisma.cardEntryRecognition.upsert({
    where: { itemId },
    create: { itemId, status: "recognizing", attemptCount: 1 },
    update: {
      status: "recognizing",
      suggestionJson: null,
      confidenceJson: null,
      errorMessage: null,
      attemptCount: { increment: 1 }
    }
  });

  try {
    const recognitionImages = await Promise.all(images.map(async (image) => {
      const buffer = await readFile(
        path.join(uploadsDir, path.basename(image.processedPath!))
      );
      if (buffer.length > maxRecognitionImageBytes) {
        throw new Error("单张预处理图片超过 10MB，无法进行 AI 识别。");
      }
      return { mimeType: "image/webp", buffer };
    }));
    const result = await recognizeCardImages(recognitionImages);
    const recognition = await prisma.cardEntryRecognition.update({
      where: { itemId },
      data: {
        status: "review",
        suggestionJson: JSON.stringify(result.suggestion),
        confidenceJson: JSON.stringify(result.confidence),
        errorMessage: null
      }
    });
    return summarizeCardEntryRecognition(recognition);
  } catch (error) {
    await prisma.cardEntryRecognition.update({
      where: { itemId },
      data: {
        status: "failed",
        errorMessage: errorMessage(error, "AI 识别失败。请检查设置后重试。").slice(0, 500)
      }
    });
    throw error;
  }
}
