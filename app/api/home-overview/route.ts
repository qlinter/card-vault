import { NextRequest, NextResponse } from "next/server";
import { loadHomeOverview } from "@/lib/home-overview";
export async function GET(request: NextRequest) {
  try { return NextResponse.json(await loadHomeOverview(Object.fromEntries(request.nextUrl.searchParams), { includeTasks: request.nextUrl.searchParams.get("tasks") === "1", handled: request.nextUrl.searchParams.get("handled") === "1", page: Number(request.nextUrl.searchParams.get("page")) })); }
  catch { return NextResponse.json({ error: "收藏概览加载失败，请重试。" }, { status: 500 }); }
}
