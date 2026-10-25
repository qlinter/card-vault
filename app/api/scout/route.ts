import { NextRequest, NextResponse } from "next/server";
import { loadScout, mutateScout } from "@/lib/scout-service";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  if (["references", "wishCards", "cards", "watch", "acquired"].some(key => params.has(key))) return NextResponse.json({ error: "该寻卡功能已移除。" }, { status: 410 });
  try { return NextResponse.json(await loadScout({ search: params.get("q")?.slice(0, 500), page: Number(params.get("page")) })); }
  catch { return NextResponse.json({ error: "心愿加载失败，请重试。" }, { status: 500 }); }
}
export async function POST(request: NextRequest) {
  try {
    const raw = await request.text();
    if (raw.length > 40000) throw new Error("提交内容过长。");
    const body = JSON.parse(raw);
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("提交内容无效。");
    return NextResponse.json(await mutateScout(body));
  } catch (error) {
    const message = error instanceof Error && !error.message.includes("prisma.") && !error.message.includes("Invocation") ? error.message : "保存失败，请刷新后重试。";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
