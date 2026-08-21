import { NextResponse } from "next/server";
import {
  createCardEntryTemplate,
  listCardEntryTemplates
} from "@/lib/card-entry-templates";
import { cardEntryErrorResponse } from "@/lib/card-entry-route";

export const runtime = "nodejs";

export async function GET() {
  try {
    return NextResponse.json({ templates: await listCardEntryTemplates() });
  } catch (error) {
    return cardEntryErrorResponse(error, "读取录入模板失败。", 500);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { name?: unknown; values?: unknown };
    return NextResponse.json({
      template: await createCardEntryTemplate({
        name: body.name,
        values: body.values
      })
    });
  } catch (error) {
    return cardEntryErrorResponse(error, "创建录入模板失败。");
  }
}
