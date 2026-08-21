import { NextResponse } from "next/server";
import { deleteCardEntryQueueItem } from "@/lib/card-entry-queue-service";
import {
  cardEntryErrorResponse,
  requireCardEntryRouteId,
  type CardEntryRouteContext
} from "@/lib/card-entry-route";

export const runtime = "nodejs";

export async function DELETE(
  _request: Request,
  context: CardEntryRouteContext
) {
  try {
    const id = await requireCardEntryRouteId(context, "待处理项编号无效。");
    await deleteCardEntryQueueItem(id);
    return NextResponse.json({ deleted: true });
  } catch (error) {
    return cardEntryErrorResponse(error, "移除待处理项失败。");
  }
}
