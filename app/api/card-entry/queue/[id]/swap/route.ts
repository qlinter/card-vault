import { NextResponse } from "next/server";
import { swapCardEntryQueueItemImages } from "@/lib/card-entry-queue-service";
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
    await swapCardEntryQueueItemImages(id);
    return NextResponse.json({ swapped: true });
  } catch (error) {
    return cardEntryErrorResponse(error, "交换正反面失败。");
  }
}
