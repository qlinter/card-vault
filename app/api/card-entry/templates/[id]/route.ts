import { NextResponse } from "next/server";
import {
  deleteCardEntryTemplate,
  updateCardEntryTemplate
} from "@/lib/card-entry-templates";
import {
  cardEntryErrorResponse,
  requireCardEntryRouteId,
  type CardEntryRouteContext
} from "@/lib/card-entry-route";

export const runtime = "nodejs";

export async function PATCH(request: Request, context: CardEntryRouteContext) {
  try {
    const id = await requireCardEntryRouteId(context, "模板编号无效。");
    const body = await request.json() as { name?: unknown; values?: unknown };
    return NextResponse.json({
      template: await updateCardEntryTemplate(id, body)
    });
  } catch (error) {
    return cardEntryErrorResponse(error, "更新录入模板失败。");
  }
}

export async function DELETE(_request: Request, context: CardEntryRouteContext) {
  try {
    const id = await requireCardEntryRouteId(context, "模板编号无效。");
    await deleteCardEntryTemplate(id);
    return NextResponse.json({ deleted: true });
  } catch (error) {
    return cardEntryErrorResponse(error, "删除录入模板失败。");
  }
}
