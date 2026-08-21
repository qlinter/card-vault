import { NextResponse } from "next/server";
import { AiUpstreamError } from "@/lib/ai-chat-client";
import { recognizeCardEntryQueueItem } from "@/lib/card-entry-recognition-service";
import {
  cardEntryErrorResponse,
  requireCardEntryRouteId,
  type CardEntryRouteContext
} from "@/lib/card-entry-route";

export const runtime = "nodejs";

export async function POST(
  _request: Request,
  context: CardEntryRouteContext
) {
  try {
    const id = await requireCardEntryRouteId(context, "待处理项编号无效。");
    return NextResponse.json({ recognition: await recognizeCardEntryQueueItem(id) });
  } catch (error) {
    return cardEntryErrorResponse(
      error,
      "AI 识别失败，请稍后重试。",
      error instanceof AiUpstreamError ? 502 : 400
    );
  }
}
