import { NextResponse } from "next/server";
import { findCardEntryDuplicates } from "@/lib/card-entry-duplicates";
import { normalizeCardEntryId } from "@/lib/card-entry-domain";
import { cardEntryErrorResponse } from "@/lib/card-entry-route";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { values?: unknown; excludeId?: unknown };
    return NextResponse.json({
      candidates: await findCardEntryDuplicates(
        body.values,
        normalizeCardEntryId(body.excludeId)
      )
    });
  } catch (error) {
    return cardEntryErrorResponse(error, "检查疑似重复卡失败。");
  }
}
