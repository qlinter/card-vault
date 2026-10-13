import { NextRequest, NextResponse } from "next/server";
import { exportScout } from "@/lib/scout-export";
import { ExportLimitError } from "@/lib/export-workspace";
export async function GET(request: NextRequest) {
  try {
    const kind = request.nextUrl.searchParams.get("kind") ?? "";
    const result = await exportScout(kind, request.signal);
    return new Response(result.body, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Length": String(result.size), "Content-Disposition": `attachment; filename="card-vault-${kind}.csv"`, "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof ExportLimitError ? error.message : "清单导出失败，请重试。" }, { status: 400 });
  }
}
