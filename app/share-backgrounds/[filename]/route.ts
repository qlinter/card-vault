import { NextRequest, NextResponse } from "next/server";
import { imageFileResponse } from "@/lib/image-response";
import { getShareBackgroundsDir } from "@/lib/storage-paths";

const shareBackgroundsDir = getShareBackgroundsDir();

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
): Promise<NextResponse> {
  const { filename } = await params;
  return imageFileResponse(shareBackgroundsDir, filename);
}
