import { NextRequest, NextResponse } from "next/server";
import { createCardEntryImageBatch } from "@/lib/card-entry-queue-service";
import { cardEntryErrorResponse } from "@/lib/card-entry-route";

export const runtime = "nodejs";
const maxBatchRequestBytes = 105 * 1024 * 1024;

export async function POST(request: NextRequest) {
  try {
    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > maxBatchRequestBytes) {
      return NextResponse.json(
        { error: "单次导入请求不能超过 105MB。" },
        { status: 413 }
      );
    }
    const formData = await request.formData();
    const files = formData
      .getAll("images")
      .filter((value): value is File => value instanceof File && value.size > 0);
    const result = await createCardEntryImageBatch({
      files,
      pairingMode: formData.get("pairingMode"),
      label: formData.get("label")
    });
    return NextResponse.json(result);
  } catch (error) {
    return cardEntryErrorResponse(error, "批量图片导入失败。");
  }
}
