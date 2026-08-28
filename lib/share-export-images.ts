import path from "node:path";
import sharp from "sharp";
import type { ExportImage } from "./share-export-types.ts";
import { normalizeCardImageRotation } from "./card-image-rotation.ts";

export const shareExportImageMaxEdge = 1600;
export const shareExportThumbnailMaxEdge = 640;
export const shareExportBackgroundMaxWidth = 2560;

type ExportImageVariantsOptions = {
  sourcePath: string;
  targetDirectory: string;
  baseName: string;
  relativeDirectory?: string;
  thumbnail?: boolean;
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  rotation?: number;
};

export type ExportImageVariants = {
  image: ExportImage;
  fileCount: number;
};

export async function createShareExportImageVariants({
  sourcePath,
  targetDirectory,
  baseName,
  relativeDirectory = "assets/images",
  thumbnail = true,
  maxWidth = shareExportImageMaxEdge,
  maxHeight = shareExportImageMaxEdge,
  quality = 84,
  rotation = 0
}: ExportImageVariantsOptions): Promise<ExportImageVariants> {
  const sourceRotation = normalizeCardImageRotation(rotation);
  const fullFileName = `${baseName}.webp`;
  const fullPath = path.join(targetDirectory, fullFileName);
  const fullInfo = await sharp(sourcePath, { failOn: "none" })
    .autoOrient()
    .rotate(sourceRotation)
    .resize({ width: maxWidth, height: maxHeight, fit: "inside", withoutEnlargement: true })
    .webp({ quality, effort: 4, smartSubsample: true })
    .toFile(fullPath);

  const src = `${relativeDirectory}/${fullFileName}`;
  let thumbnailSrc = src;
  let fileCount = 1;
  if (thumbnail) {
    const thumbnailFileName = `${baseName}-thumb.webp`;
    await sharp(sourcePath, { failOn: "none" })
      .autoOrient()
      .rotate(sourceRotation)
      .resize({
        width: shareExportThumbnailMaxEdge,
        height: shareExportThumbnailMaxEdge,
        fit: "inside",
        withoutEnlargement: true
      })
      .webp({ quality: 78, effort: 4, smartSubsample: true })
      .toFile(path.join(targetDirectory, thumbnailFileName));
    thumbnailSrc = `${relativeDirectory}/${thumbnailFileName}`;
    fileCount += 1;
  }

  return {
    image: {
      src,
      thumbnailSrc,
      width: fullInfo.width,
      height: fullInfo.height,
      rotation: 0,
      sourceRotation
    },
    fileCount
  };
}
