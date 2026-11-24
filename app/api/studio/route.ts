import { NextResponse } from "next/server";
import { accountStatus } from "@/lib/account-server";
import { generateStudioImage, studioInventory } from "@/lib/studio-images";

export async function GET() {
  if (!(await accountStatus()).authenticated) return new Response(null, { status: 403 });
  return NextResponse.json(await studioInventory(), { headers: { "Cache-Control": "no-store" } });
}
export async function POST(request: Request) {
  if (!(await accountStatus()).authenticated) return new Response(null, { status: 403 });
  const body = await request.json().catch(() => null);
  const id = body?.id;
  if (typeof id !== "string" || !id || id.length > 128) return new Response(null, { status: 400 });
  try {
    await generateStudioImage(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    return NextResponse.json({ error: /^[\u3400-\u9fff]|^OpenAI/.test(message) ? message : "图片生成失败，请检查网络和原图后重试。" }, { status: 502 });
  }
}
