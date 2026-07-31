import { NextRequest, NextResponse } from "next/server";
import { imageFileResponse } from "@/lib/image-response";
import { getUploadsDir } from "@/lib/storage-paths";

const uploadDir = getUploadsDir();

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
): Promise<NextResponse> {
  const { filename } = await params;
  return imageFileResponse(uploadDir, filename);
}
