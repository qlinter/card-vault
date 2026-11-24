import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import {
  ensureHomeThumbnail,
  sourceFileNameFromHomeThumbnail
} from "@/lib/card-thumbnail-core.js";
import { authorizeCardImage, readImageFile } from "@/lib/image-response";
import { getThumbnailsDir, getUploadsDir } from "@/lib/storage-paths";

type ThumbnailRouteContext = { params: Promise<{ filename: string }> };

const uploadsDir = getUploadsDir();
const thumbnailsDir = getThumbnailsDir();

export async function GET(_request: NextRequest, { params }: ThumbnailRouteContext): Promise<NextResponse> {
  const { filename } = await params;
  const sourceName = sourceFileNameFromHomeThumbnail(filename);
  if (!sourceName || filename !== path.basename(filename)) return NextResponse.json({ message: "File not found" }, { status: 404 });
  const denied = await authorizeCardImage(sourceName);
  if (denied) return denied;

  const thumbnailName = path.basename(filename);
  try {
    await ensureHomeThumbnail(
      path.join(uploadsDir, sourceName),
      path.join(thumbnailsDir, thumbnailName)
    );
    return readImageFile(thumbnailsDir, thumbnailName);
  } catch {
    return NextResponse.json({ message: "File not found" }, { status: 404 });
  }
}
