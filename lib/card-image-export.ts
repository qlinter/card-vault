import path from "node:path";

export function exportImageFilename(title: string, index: number, extension: string): string {
  const stem = Array.from(title.normalize("NFC")).slice(0, 80).join("").replace(/[\p{Cc}<>:"/\\|?*]/gu, "-").replace(/[. ]+$/g, "").trim() || "card";
  return `${stem}-${String(index + 1).padStart(2, "0")}${extension}`;
}

export function managedImageFilename(imagePath: string): string {
  const match = /^\/media\/([^/\\]+\.(?:jpe?g|png|webp))$/i.exec(imagePath);
  if (!match || path.basename(match[1]) !== match[1] || /[\p{Cc}<>:"|?*]/u.test(match[1])) throw new Error("卡片图片路径无效。");
  return match[1];
}
