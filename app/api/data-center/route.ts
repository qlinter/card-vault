import { NextRequest, NextResponse } from "next/server";
import { applyJob, getJob, previewImport, readImportFile, repreviewJob } from "@/lib/data-center";
import { exportCards } from "@/lib/card-data-export";
import { normalizePortfolioFilterInput } from "@/lib/portfolio-analysis";
import { prisma } from "@/lib/prisma";
import { buildCardFilters } from "@/lib/card-helpers";
import { parseExportSelection } from "@/lib/card-export-selection";
export const runtime = "nodejs";
const active = new Set<string>();
async function exportResponse(query: Record<string, unknown>, format: string, publicOnly: boolean, selection?: unknown) {
  const result = await exportCards(normalizePortfolioFilterInput(query), format, publicOnly, parseExportSelection(selection));
  return new NextResponse(new Uint8Array(result.bytes), { headers: { "Content-Type": result.type, "Content-Disposition": `attachment; filename="card-vault-${publicOnly ? "public" : "private"}.${result.extension}"`, "Cache-Control": "no-store" } });
}
export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    if (params.has("selection")) {
      const rows = await prisma.card.findMany({ where: buildCardFilters(normalizePortfolioFilterInput(Object.fromEntries(params))), select: { id: true }, take: 10001, orderBy: { id: "asc" } });
      if (rows.length > 10000) throw new Error("每批最多选择 10000 张卡片，请缩小搜索范围。");
      return NextResponse.json({ ids: rows.map(row => row.id) });
    }
    if (params.has("export")) {
      return await exportResponse(Object.fromEntries(params), params.get("export")!, params.get("publicOnly") === "true", params.get("ids"));
    }
    if (!params.get("id")) throw new Error("请指定导入批次。");
    return NextResponse.json(await getJob(params.get("id")!));
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "读取失败。" }, { status: 400 }); }
}
export async function POST(request: NextRequest) {
  let lock: string | undefined;
  try {
    if (request.headers.get("content-type")?.includes("application/x-www-form-urlencoded")) {
      const text = await request.text();
      if (text.length > 2 * 1024 * 1024) throw new Error("请求超过大小限制。");
      const form = new URLSearchParams(text);
      if (form.get("action") !== "export") throw new Error("操作无效。");
      return await exportResponse({ q: form.get("q") }, form.get("format") ?? "", form.get("publicOnly") === "true", form.get("ids"));
    }
    if (request.headers.get("content-type")?.includes("multipart/form-data")) {
      if (Number(request.headers.get("content-length")) > 11 * 1024 * 1024) throw new Error("文件不能超过 10 MB。");
      const form = await request.formData(), file = form.get("file");
      if (!(file instanceof File)) throw new Error("请选择文件。");
      return NextResponse.json(await readImportFile(file));
    }
    const text = await request.text();
    if (text.length > 15 * 1024 * 1024) throw new Error("请求超过大小限制。");
    const body = JSON.parse(text);
    if (body.action === "preview") return NextResponse.json(await previewImport(body.headers, body.rows, body.mapping, body.policy));
    if (body.action === "repreview" && typeof body.id === "string") return NextResponse.json(await repreviewJob(body.id));
    if (body.action !== "apply" && body.action !== "undo") throw new Error("操作无效。");
    if (typeof body.id !== "string" || body.id.length > 128 || (body.cursor !== undefined && (!Number.isInteger(body.cursor) || body.cursor < 0))) throw new Error("批次参数无效。");
    if (active.has(body.id)) throw new Error("此批次正在处理中，请稍后重试。");
    lock = body.id; active.add(body.id);
    return NextResponse.json(await applyJob(body.id, body.action === "undo", body.cursor));
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "操作失败。" }, { status: 400 }); }
  finally { if (lock) active.delete(lock); }
}
