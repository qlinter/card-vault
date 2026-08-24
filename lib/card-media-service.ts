import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { prepareImageUpload } from "@/lib/image-upload";
import { removeHomeThumbnail } from "@/lib/card-thumbnail-core.js";
import { getThumbnailsDir, getUploadsDir } from "@/lib/storage-paths";

export const maxImagesPerCard = 5;
const uploadDir = getUploadsDir();
const thumbnailsDir = getThumbnailsDir();

function toImagePublicPath(fileName: string): string {
  return `/media/${fileName}`;
}

export function readCardImageFiles(formData: FormData): File[] {
  return formData.getAll("images").filter((entry): entry is File => entry instanceof File && entry.size > 0);
}

export async function saveCardUploads(files: File[]): Promise<string[]> {
  const preparedFiles = await Promise.all(files.map((file) => prepareImageUpload(file, "卡片图片")));
  await mkdir(uploadDir, { recursive: true });
  const imagePaths: string[] = [];

  try {
    for (const prepared of preparedFiles) {
      const fileName = `${Date.now()}-${randomUUID()}.${prepared.extension}`;
      const imagePath = toImagePublicPath(fileName);
      const fullPath = path.join(uploadDir, fileName);
      await writeFile(fullPath, prepared.buffer);
      imagePaths.push(imagePath);
    }
    return imagePaths;
  } catch (error) {
    await Promise.all(imagePaths.map((imagePath) => removeCardImageIfExists(imagePath)));
    throw error;
  }
}

export async function removeCardImageIfExists(relativePath: string): Promise<void> {
  const fileName = path.basename(relativePath);
  const fullPath = path.join(uploadDir, fileName);
  try {
    await unlink(fullPath);
  } catch {
    // 文件可能已由用户手动移除，数据库清理不应因此失败。
  }
  await removeHomeThumbnail(thumbnailsDir, relativePath).catch(() => {
    // 缓存清理失败不应阻止卡片删除。
  });
}
