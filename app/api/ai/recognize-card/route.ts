import { NextRequest, NextResponse } from "next/server";
import { AiUpstreamError } from "@/lib/ai-chat-client";
import { recognizeCardImages } from "@/lib/card-recognition";
import { errorMessage } from "@/lib/feedback-messages";
import { prepareImageUpload } from "@/lib/image-upload";

export const runtime = "nodejs";

const maxImageBytes = 10 * 1024 * 1024;
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const files = formData.getAll("images").filter((entry): entry is File => entry instanceof File && entry.size > 0);

    if (files.length < 1 || files.length > 2) {
      return NextResponse.json({ error: "请选择 1 到 2 张图片用于 AI 识别。" }, { status: 400 });
    }

    const prepared = await Promise.all(files.map((file) =>
      prepareImageUpload(file, "AI 识别图片", maxImageBytes)
    ));
    return NextResponse.json(await recognizeCardImages(prepared.map((image) => ({
      mimeType: image.extension === "jpg" ? "image/jpeg" : `image/${image.extension}`,
      buffer: image.buffer
    }))));
  } catch (error) {
    const message = errorMessage(error, "AI 识别失败，请稍后重试。");
    return NextResponse.json({ error: message }, { status: error instanceof AiUpstreamError ? 502 : 400 });
  }
}
