import { NextRequest, NextResponse } from "next/server";
import { normalizeRecapSpec } from "@/lib/collection-recap";
import { loadRecapSummary, recapCards } from "@/lib/collection-recap-service";

export async function GET(request: NextRequest) {
  try {
    const spec = normalizeRecapSpec(JSON.parse(request.nextUrl.searchParams.get("spec") ?? "{}"));
    const page = Math.max(0, Math.min(1000000, Math.floor(Number(request.nextUrl.searchParams.get("page")) || 0)));
    const cards = await recapCards(spec, { page, q: request.nextUrl.searchParams.get("q")?.slice(0, 160) });
    return NextResponse.json({ cards, ...(request.nextUrl.searchParams.has("cardsOnly") ? {} : { summary: await loadRecapSummary(spec) }) }, { headers: { "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ error: "无法读取回顾，请检查日期和筛选条件。" }, { status: 400 }); }
}

