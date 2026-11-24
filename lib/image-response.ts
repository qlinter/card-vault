import { readFile } from "fs/promises";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { accountStatus } from "./account-server";
import { prisma } from "./prisma";
import { guestShowcaseVisibility } from "./showcase";

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
  if (!(await accountStatus()).authenticated) return NextResponse.json({ error: "login-required" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  return readImageFile(directory, fileName);
}

export async function authorizeCardImage(sourceName: string): Promise<NextResponse | undefined> {
  const status = await accountStatus();
  if (status.authenticated) return;
  const headers = { "Cache-Control": "no-store, private" };
  if (!status.guest) return NextResponse.json({ error: "login-required" }, { status: 401, headers });
  const safeName = /^[^/\\:\p{Cc}]+\.(?:png|webp|jpe?g)$/iu.test(sourceName);
  if (safeName && await prisma.cardImage.findFirst({
    where: { path: `/media/${sourceName}`, card: { visibility: guestShowcaseVisibility } },
    select: { id: true }
  })) return;
  return NextResponse.json({ message: "File not found" }, { status: 404, headers });
}

export async function readImageFile(directory: string, fileName: string): Promise<NextResponse> {
  try {
    const safeName = path.basename(fileName);
    const fileBuffer = await readFile(path.join(directory, safeName));

    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": imageContentType(safeName),
        "Cache-Control": "no-store, private"
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
