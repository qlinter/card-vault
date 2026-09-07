import { NextRequest, NextResponse } from "next/server";
import { loadHomeData } from "@/lib/home-data";
import { normalizePortfolioFilterInput } from "@/lib/portfolio-analysis";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const page = Number(params.get("page") ?? 0);
  if (!Number.isSafeInteger(page) || page < 0 || page > 100000) return NextResponse.json({ error: "Invalid page" }, { status: 400 });
  try { return NextResponse.json(await loadHomeData({ ...normalizePortfolioFilterInput(Object.fromEntries(params)), sort: params.get("sort") ?? undefined }, page)); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "加载失败。" }, { status: 400 }); }
}
