import { NextRequest, NextResponse } from "next/server";
import { loadHomeOverview } from "@/lib/home-overview";
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  try { return NextResponse.json(await loadHomeOverview(Object.fromEntries(params), { includeTasks: params.get("tasks") === "1", handled: params.get("handled") === "1", page: Number(params.get("page")), followupOnly: params.get("review") === "followup", search: params.get("reviewSearch") || undefined })); }
  catch { return NextResponse.json({ error: "收藏概览加载失败，请重试。" }, { status: 500 }); }
}
