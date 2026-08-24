export const homeThumbnailMaxEdge: number;

export function homeThumbnailFileName(imagePath: string): string;
export function sourceFileNameFromHomeThumbnail(thumbnailName: string): string | null;
export function homeThumbnailPublicPath(imagePath: string): string;
export function ensureHomeThumbnail(
  sourcePath: string,
  targetPath: string
): Promise<{ status: "cached" | "generated"; path: string }>;
export function removeHomeThumbnail(thumbnailsDir: string, imagePath: string): Promise<void>;
