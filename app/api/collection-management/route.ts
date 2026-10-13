import { NextResponse } from "next/server";
import { mutateCollectionManagement } from "@/lib/collection-management";
export async function POST(request: Request) {
  try { const text = await request.text(); if (text.length > 30000) throw new Error("请求过大。"); await mutateCollectionManagement(JSON.parse(text)); return NextResponse.json({ ok: true }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "操作失败。" }, { status: 400 }); }
}
