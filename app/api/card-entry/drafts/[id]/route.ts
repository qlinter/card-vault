import { NextResponse } from "next/server";
import { deleteCardEntryDraft } from "@/lib/card-entry-drafts";
import {
  cardEntryErrorResponse,
  requireCardEntryRouteId,
  type CardEntryRouteContext
} from "@/lib/card-entry-route";

export const runtime = "nodejs";

export async function DELETE(_request: Request, context: CardEntryRouteContext) {
  try {
    const id = await requireCardEntryRouteId(context, "草稿编号无效。");
    await deleteCardEntryDraft(id);
    return NextResponse.json({ deleted: true });
  } catch (error) {
    return cardEntryErrorResponse(error, "草稿删除失败。");
  }
}
