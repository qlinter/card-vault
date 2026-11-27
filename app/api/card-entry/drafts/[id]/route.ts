import { NextResponse } from "next/server";
import { deleteCardEntryDraft } from "@/lib/card-entry-drafts";
import {
  cardEntryErrorResponse,
  requireCardEntryRouteId,
  type CardEntryRouteContext
} from "@/lib/card-entry-route";

export const runtime = "nodejs";

export async function DELETE(request: Request, context: CardEntryRouteContext) {
  try {
    const id = await requireCardEntryRouteId(context, "草稿编号无效。");
    const result = await deleteCardEntryDraft(id, request.headers.get("x-draft-version"));
    return NextResponse.json(result, { status: result.deleted ? 200 : 409 });
  } catch (error) {
    return cardEntryErrorResponse(error, "草稿删除失败。");
  }
}
