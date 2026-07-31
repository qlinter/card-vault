export const supportedImageMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
export const maxStoredImageBytes = 15 * 1024 * 1024;

type PreparedImageUpload = {
  buffer: Buffer;
  extension: "jpg" | "png" | "webp";
};

function hasPngSignature(buffer: Buffer): boolean {
  return (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  );
}

function hasJpegSignature(buffer: Buffer): boolean {
  return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
}

function hasWebpSignature(buffer: Buffer): boolean {
  return (
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  );
}

export async function prepareImageUpload(
  file: File,
  label: string,
  maxBytes = maxStoredImageBytes
): Promise<PreparedImageUpload> {
  if (!supportedImageMimeTypes.has(file.type)) {
    throw new Error(`${label}仅支持 jpg、jpeg、png、webp 图片格式。`);
  }
  if (file.size <= 0) {
    throw new Error(`${label}不能为空。`);
  }
  if (file.size > maxBytes) {
    throw new Error(`${label}不能超过 ${Math.floor(maxBytes / 1024 / 1024)}MB。`);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  if (file.type === "image/jpeg" && hasJpegSignature(buffer)) {
    return { buffer, extension: "jpg" };
  }
  if (file.type === "image/png" && hasPngSignature(buffer)) {
    return { buffer, extension: "png" };
  }
  if (file.type === "image/webp" && hasWebpSignature(buffer)) {
    return { buffer, extension: "webp" };
  }

  throw new Error(`${label}的实际文件内容与图片格式不一致。`);
}
