import { copyFile, lstat, realpath } from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUploadsDir } from "@/lib/storage-paths";
import { exportImageFilename, managedImageFilename } from "@/lib/card-image-export";
import { exportInWorkspace, ExportLimitError } from "@/lib/export-workspace";
import { writeStreamingZip } from "@/lib/streaming-zip";

export const runtime = "nodejs";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const card = await prisma.card.findUnique({ where: { id }, select: { cardTitle: true, images: { orderBy: { createdAt: "asc" }, select: { path: true } } } });
    if (!card || !card.images.length) return NextResponse.json({ error: "没有可导出的卡片图片。" }, { status: 404 });
    let filename = "", type = "application/zip";
    const result = await exportInWorkspace(async ({ directory, signal }) => {
      const uploads = await realpath(getUploadsDir());
      const entries = [];
      for (const [index, image] of card.images.entries()) {
        signal.throwIfAborted();
        const source = path.join(uploads, managedImageFilename(image.path));
        if (!(await lstat(source)).isFile() || path.dirname(await realpath(source)) !== uploads) throw new Error("图片文件不可用。");
        const name = exportImageFilename(card.cardTitle, index, path.extname(source).toLowerCase());
        const target = path.join(directory, name);
        await copyFile(source, target);
        entries.push({ name, path: target });
      }
      if (entries.length === 1) {
        filename = entries[0].name;
        const ext = path.extname(filename);
        type = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";
        return entries[0].path;
      }
      filename = exportImageFilename(card.cardTitle, 0, ".zip").replace(/-01\.zip$/, "-images.zip");
      const output = path.join(directory, "images.zip");
      await writeStreamingZip(output, entries, signal);
      return output;
    }, request.signal);
    return new NextResponse(result.body, { headers: { "Content-Type": type, "Content-Length": String(result.size), "Content-Disposition": `attachment; filename="card-images${path.extname(filename)}"; filename*=UTF-8''${encodeURIComponent(filename).replace(/['()]/g, char => `%${char.charCodeAt(0).toString(16)}`)}`, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof ExportLimitError ? error.message : "图片导出失败，请检查图片文件后重试。" }, { status: error instanceof ExportLimitError ? 429 : 400 });
  }
}
