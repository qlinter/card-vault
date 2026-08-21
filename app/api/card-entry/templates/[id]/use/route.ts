import { NextResponse } from "next/server";
import { markCardEntryTemplateUsed } from "@/lib/card-entry-templates";
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
    const id = await requireCardEntryRouteId(context, "模板编号无效。");
    return NextResponse.json({ template: await markCardEntryTemplateUsed(id) });
  } catch (error) {
    return cardEntryErrorResponse(error, "应用录入模板失败。");
  }
}
