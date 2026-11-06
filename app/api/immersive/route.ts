import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toShowcaseWhere } from "@/lib/showcase";
import { normalizeRecapSpec, recapActivity, representativeIds } from "@/lib/collection-recap";
import { recapWhere } from "@/lib/collection-recap-service";

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams, spec = params.has("spec") ? normalizeRecapSpec(JSON.parse(params.get("spec")!)) : undefined;
    const restricted = params.has("ids") ? representativeIds(JSON.parse(params.get("ids")!)) : undefined;
    const where = spec ? recapWhere(spec) : toShowcaseWhere({ q: params.get("q")?.slice(0, 160), group: params.get("group")?.slice(0, 160) });
    const id = params.get("id"), cursor = params.get("cursor");
    const revision = id ? undefined : (await prisma.dataRevision.findUniqueOrThrow({ where: { id: 1 } })).revision.toString();
    const cards = await prisma.card.findMany({ where: { AND: [where, ...(restricted ? [{ id: { in: restricted } }] : []), ...(id ? [{ id }] : cursor && spec ? [{ id: { gt: cursor } }] : [])] },
      orderBy: spec ? [{ id: "asc" }] : [{ playerName: "asc" }, { createdAt: "desc" }, { id: "asc" }], take: id ? 1 : 500, ...(cursor && !spec && !id ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: { id: true, ...(spec ? { createdAt: true, transactions: { where: { kind: "purchase" }, select: { occurredAt: true, quantity: true } } } : {}),
        ...(id ? { playerName: true, cardTitle: true, collectionStatus: true, year: true, brand: true, productLine: true, parallel: true, gradingCompany: true, grade: true, serialNumber: true, serialRange: true,
          images: { take: 5, orderBy: [{ createdAt: "asc" }, { id: "asc" }], select: { id: true, path: true, rotation: true } } } : {}) } });
    const matching = cards.filter(card => !spec || recapActivity(spec, card as unknown as { createdAt: Date; transactions: { occurredAt: Date; quantity: number }[] }).length);
    if (id) {
      const card = matching[0];
      return card ? NextResponse.json({ card: { id: card.id, playerName: card.playerName, cardTitle: card.cardTitle, collectionStatus: card.collectionStatus, year: card.year, brand: card.brand, productLine: card.productLine, parallel: card.parallel, gradingCompany: card.gradingCompany, grade: card.grade, serialNumber: card.serialNumber, serialRange: card.serialRange, images: card.images } }, { headers: { "Cache-Control": "no-store" } }) : NextResponse.json({ error: "卡片已删除或不在当前范围。" }, { status: 404 });
    }
    return NextResponse.json({ ids: matching.map(card => card.id), nextCursor: cards.length === 500 ? cards.at(-1)!.id : null, revision }, { headers: { "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ error: "无法加载赏卡范围，请重试。" }, { status: 400 }); }
}
