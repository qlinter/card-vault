import type { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { showcaseOrderBy, toShowcaseWhere } from "@/lib/showcase";
import { normalizeRecapSpec, recapActivity, representativeIds } from "@/lib/collection-recap";
import { recapActivitySelect, recapWhere } from "@/lib/collection-recap-service";

const batchSize = 500;
const responseOptions = { headers: { "Cache-Control": "no-store" } };
const galleryCardSelect = {
  id: true, playerName: true, cardTitle: true, collectionStatus: true,
  year: true, brand: true, productLine: true, parallel: true, gradingCompany: true,
  grade: true, serialNumber: true, serialRange: true,
  images: {
    take: 5, orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { id: true, path: true, rotation: true }
  }
} satisfies Prisma.CardSelect;

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const rawSpec = params.get("spec");
    const rawIds = params.get("ids");
    const spec = rawSpec === null ? undefined : normalizeRecapSpec(JSON.parse(rawSpec));
    const id = params.get("id");
    const cursor = params.get("cursor");
    const scope = spec ? recapWhere(spec) : toShowcaseWhere({
      q: params.get("q")?.slice(0, 160), group: params.get("group")?.slice(0, 160)
    });
    const conditions: Prisma.CardWhereInput[] = [scope];
    if (!spec && params.get("excludeSold") === "1") conditions.push({ collectionStatus: { not: "sold" } });
    if (rawIds !== null) conditions.push({ id: { in: representativeIds(JSON.parse(rawIds)) } });
    if (id) conditions.push({ id });
    else if (cursor && spec) conditions.push({ id: { gt: cursor } });

    const query = {
      where: { AND: conditions },
      orderBy: spec ? { id: "asc" as const } : showcaseOrderBy,
      take: id ? 1 : batchSize,
      ...(cursor && !spec && !id ? { cursor: { id: cursor }, skip: 1 } : {})
    };
    const select = id ? galleryCardSelect : { id: true as const };
    const revision = id ? undefined : (await prisma.dataRevision.findUniqueOrThrow({ where: { id: 1 } })).revision.toString();

    // Recap periods are evaluated on decoded dates, including legacy SQLite timestamp formats.
    // Advance the cursor over the scanned rows even if no card in the batch matches the period.
    const recapBatch = spec
      ? await prisma.card.findMany({ ...query, select: { ...select, ...recapActivitySelect } })
      : null;
    const batch = recapBatch ?? await prisma.card.findMany({ ...query, select });
    const matching = spec && recapBatch
      ? recapBatch.flatMap(({ createdAt, transactions, ...card }) =>
          recapActivity(spec, { createdAt, transactions }).length ? [card] : [])
      : batch;
    if (id) {
      return matching.length
        ? NextResponse.json({ card: matching[0] }, responseOptions)
        : NextResponse.json({ error: "卡牌已删除或不在当前范围。" }, { status: 404 });
    }
    return NextResponse.json({
      ids: matching.map(card => card.id), nextCursor: batch.length === batchSize ? batch.at(-1)!.id : null, revision
    }, responseOptions);
  } catch {
    return NextResponse.json({ error: "无法加载赏卡范围，请重试。" }, { status: 400 });
  }
}
