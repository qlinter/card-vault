import { NextResponse } from "next/server";
import { maxStoredImageBytes } from "@/lib/card-image-limits.js";
import { accountStatus } from "@/lib/account-server";
import { generateStudioImage, studioInventory, singleStudioStatus, readStudioPreview, reviewStudioImage, uploadStudioPreview } from "@/lib/studio-images";

export async function GET(request: Request) {
  if (!(await accountStatus()).authenticated) return new Response(null, { status: 403 });
  const params = new URL(request.url).searchParams;
  const image = params.get("image");
  if (image) {
    const bytes = await readStudioPreview(image, params.has("candidate"));
    return bytes ? new Response(new Uint8Array(bytes), { headers: { "Content-Type": "image/png", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } }) : new Response(null, { status: 404 });
  }
  const id = params.get("id");
  const status = id ? await singleStudioStatus(id) : await studioInventory();
  return NextResponse.json(status, { headers: { "Cache-Control": "no-store" } });
}
export async function POST(request: Request) {
  if (!(await accountStatus()).authenticated) return new Response(null, { status: 403 });
  if (request.headers.get("content-type")?.startsWith("multipart/form-data")) {
    if (Number(request.headers.get("content-length")) > maxStoredImageBytes + 65536)
      return NextResponse.json({ error: "展馆图不能超过 15MB。" }, { status: 413 });
    const form = await request.formData().catch(() => null);
    const id = form?.get("id"), version = form?.get("version"), image = form?.get("image");
    if (typeof id !== "string" || !id || id.length > 128 || typeof version !== "string" || !(image instanceof File))
      return NextResponse.json({ error: "请选择展馆图片后再试。" }, { status: 400 });
    try {
      await uploadStudioPreview(id, version, image);
      return NextResponse.json({ ok: true });
    } catch (error) {
      const message = error instanceof Error && /^[\u3400-\u9fff]/.test(error.message) ? error.message : "展馆图上传失败，请重试。";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }
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
