import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { recapDraft, recapCards, loadRecapSummary } from "@/lib/collection-recap-service";
import { renderRecapImage } from "@/lib/collection-recap-image";
import { exportInWorkspace, ExportLimitError } from "@/lib/export-workspace";

export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  try {
    const value = await request.json(), draft = recapDraft(value), includePrivate = value.includePrivate === true;
    let count = 0, quantity = 0;
    const result = await exportInWorkspace(async ({ directory, signal }) => {
      const revision = async () => (await prisma.dataRevision.findUniqueOrThrow({ where: { id: 1 } })).revision;
      const before = await revision(), summary = await loadRecapSummary(draft.spec, includePrivate), cards = await recapCards(draft.spec, { ids: draft.ids, includePrivate });
      count = summary.cardCount; quantity = summary.quantity;
      if (await revision() !== before) throw new Error("收藏数据刚刚发生变化，请重新生成预览。");
      const ordered = draft.ids.flatMap(id => { const card = cards.find(row => row.id === id); return card ? [card] : []; });
      const output = path.join(directory, "recap.png");
      await renderRecapImage({ ...draft, summary, cards: ordered, includePrivate, locale: value.locale === "en" ? "en" : "zh-CN" }, output, signal);
      return output;
    }, request.signal);
    return new NextResponse(result.body, { headers: { "Content-Type": "image/png", "Content-Length": String(result.size), "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "X-Recap-Records": String(count), "X-Recap-Quantity": String(quantity) } });
  } catch (error) { return NextResponse.json({ error: error instanceof ExportLimitError ? error.message : "回顾图片生成失败，请重试。" }, { status: error instanceof ExportLimitError ? 429 : 400 }); }
}
