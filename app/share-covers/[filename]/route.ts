import { NextRequest, NextResponse } from "next/server";
import { imageFileResponse } from "@/lib/image-response";
import { getShareCoversDir } from "@/lib/storage-paths";

const shareCoversDir = getShareCoversDir();

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
): Promise<NextResponse> {
  const { filename } = await params;
  return imageFileResponse(shareCoversDir, filename);
}
