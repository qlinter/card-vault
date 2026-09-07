import { NextResponse } from "next/server";
import { loadCollectionManagement, mutateCollectionManagement } from "@/lib/collection-management";
export async function GET() {
  try { return NextResponse.json(await loadCollectionManagement()); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "读取失败。" }, { status: 400 }); }
}
export async function POST(request: Request) {
  try { const text = await request.text(); if (text.length > 30000) throw new Error("请求过大。"); await mutateCollectionManagement(JSON.parse(text)); return NextResponse.json({ ok: true }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "操作失败。" }, { status: 400 }); }
}
