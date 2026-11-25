import { NextResponse } from "next/server";
import { accountStatus } from "@/lib/account-server";
import { generateStudioImage, studioInventory, singleStudioStatus, readStudioPreview, reviewStudioImage } from "@/lib/studio-images";

export async function GET(request: Request) {
  if (!(await accountStatus()).authenticated) return new Response(null, { status: 403 });
  const params = new URL(request.url).searchParams;
  const image = params.get("image");
  if (image) {
    const bytes = await readStudioPreview(image, params.has("candidate"));
    return bytes ? new Response(new Uint8Array(bytes), { headers: { "Content-Type": "image/png", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } }) : new Response(null, { status: 404 });
  }
  const id = params.get("id");
  if (id) return NextResponse.json(await singleStudioStatus(id), { headers: { "Cache-Control": "no-store" } });
  return NextResponse.json(await studioInventory(), { headers: { "Cache-Control": "no-store" } });
}
export async function POST(request: Request) {
  if (!(await accountStatus()).authenticated) return new Response(null, { status: 403 });
  const body = await request.json().catch(() => null);
  const id = body?.id;
  if (typeof id !== "string" || !id || id.length > 128) return new Response(null, { status: 400 });
  try {
    switch (body.action) {
      case undefined: await generateStudioImage(id); break;
      case "redo":
        if (!body.version || typeof body.version !== "string") return new Response(null, { status: 400 });
        await generateStudioImage(id, body.version); break;
      case "adopt": case "discard":
        await reviewStudioImage(id, body.version, body.candidate, body.action === "adopt"); break;
      default: return new Response(null, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    return NextResponse.json({ error: /^[\u3400-\u9fff]|^OpenAI/.test(message) ? message : "图片生成失败，请检查网络和原图后重试。" }, { status: 502 });
  }
}
