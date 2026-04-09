import { readFile } from "fs/promises";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { getUploadsDir } from "@/lib/storage-paths";

const uploadDir = getUploadsDir();

function getContentType(fileName: string): string {
  const extension = path.extname(fileName).toLowerCase();
  switch (extension) {
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

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
): Promise<NextResponse> {
  try {
    const { filename } = await params;
    const safeName = path.basename(filename);
    const filePath = path.join(uploadDir, safeName);
    const fileBuffer = await readFile(filePath);

    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": getContentType(safeName),
        "Cache-Control": "public, max-age=31536000, immutable"
      }
    });
  } catch {
    return NextResponse.json({ message: "File not found" }, { status: 404 });
  }
}
