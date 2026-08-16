import { readFile } from "fs/promises";
import path from "path";
import { NextRequest, NextResponse } from "next/server";

type ImageRouteContext = { params: Promise<{ filename: string }> };

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

export function createImageFileRoute(directory: string) {
  return async function GET(_request: NextRequest, { params }: ImageRouteContext): Promise<NextResponse> {
    const { filename } = await params;
    return imageFileResponse(directory, filename);
  };
}
