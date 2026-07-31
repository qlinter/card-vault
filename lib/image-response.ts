import { readFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";

function imageContentType(fileName: string): string {
  switch (path.extname(fileName).toLowerCase()) {
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".png":
      return "image/png";
    case ".webp":
      return "image/webp";
    default:
      return "application/octet-stream";
  }
}

export async function imageFileResponse(directory: string, fileName: string): Promise<NextResponse> {
  try {
    const safeName = path.basename(fileName);
    const fileBuffer = await readFile(path.join(directory, safeName));

    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": imageContentType(safeName),
        "Cache-Control": "public, max-age=31536000, immutable"
      }
    });
  } catch {
    return NextResponse.json({ message: "File not found" }, { status: 404 });
  }
}
