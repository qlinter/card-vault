import { NextRequest, NextResponse } from "next/server";
import { saveCardEntryDraft } from "@/lib/card-entry-drafts";
import { normalizeCardEntryId } from "@/lib/card-entry-domain";
import { cardEntryErrorResponse } from "@/lib/card-entry-route";
import { maxCardImageRequestBytes } from "@/lib/card-image-limits.js";

export const runtime = "nodejs";
const maxDraftRequestBytes = 100_000;

class DraftRequestTooLargeError extends Error {}

async function readDraftPayload(
  request: NextRequest
): Promise<{ id?: unknown; values?: unknown; imageRotations?: unknown }> {
  if (!request.body) return {};
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let totalBytes = 0;
  let body = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > maxDraftRequestBytes) {
      await reader.cancel();
      throw new DraftRequestTooLargeError("草稿内容过大。");
    }
    body += decoder.decode(value, { stream: true });
  }
  body += decoder.decode();
  return JSON.parse(body) as { id?: unknown; values?: unknown; imageRotations?: unknown };
}

export async function POST(request: NextRequest) {
  try {
    const contentLength = Number(request.headers.get("content-length") || 0);
    if (request.headers.get("content-type")?.includes("multipart/form-data")) {
      if (contentLength > maxCardImageRequestBytes) throw new DraftRequestTooLargeError("草稿图片过大。");
      const form = await request.formData();
      const values = String(form.get("values") || "{}");
      if (Buffer.byteLength(values) > maxDraftRequestBytes) throw new DraftRequestTooLargeError("草稿内容过大。");
      const id = normalizeCardEntryId(form.get("id"));
      if (form.has("id") && !id) throw new Error("草稿编号无效。");
      const images = form.getAll("images").filter((file): file is File => file instanceof File);
      const draft = await saveCardEntryDraft({ id, values: JSON.parse(values), images, imageRotations: JSON.parse(String(form.get("imageRotations") || "[]")) });
      return NextResponse.json({ id: draft.id, updatedAt: draft.updatedAt.toISOString() });
    }
    if (contentLength > maxDraftRequestBytes) {
      return NextResponse.json({ error: "草稿内容过大。" }, { status: 413 });
    }
    const payload = await readDraftPayload(request);
    const id = normalizeCardEntryId(payload.id);
    if (payload.id !== undefined && !id) {
      return NextResponse.json({ error: "草稿编号无效。" }, { status: 400 });
    }
    const draft = await saveCardEntryDraft({ id, values: payload.values, imageRotations: payload.imageRotations });
    return NextResponse.json({ id: draft.id, updatedAt: draft.updatedAt.toISOString() });
  } catch (error) {
    if (error instanceof DraftRequestTooLargeError) {
      return NextResponse.json({ error: error.message }, { status: 413 });
    }
    return cardEntryErrorResponse(error, "草稿保存失败。");
  }
}
