import { NextResponse } from "next/server";
import { retryCardEntryQueueItem } from "@/lib/card-entry-queue-service";
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
    const item = await retryCardEntryQueueItem(id);
    return NextResponse.json({ status: item.status, error: item.errorMessage });
  } catch (error) {
    return cardEntryErrorResponse(error, "重试图片预处理失败。");
  }
}
