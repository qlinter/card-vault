export function normalizeImagePath(imagePath: string): string {
  if (imagePath.startsWith("/media/")) {
    return imagePath;
  }

  if (imagePath.startsWith("/uploads/")) {
    return imagePath.replace("/uploads/", "/media/");
  }

  return imagePath;
}