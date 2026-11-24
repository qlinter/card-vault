import { cardImageOrder } from "@/lib/card-image-order";
import path from "node:path";
import { getThumbnailsDir } from "@/lib/storage-paths";
import { ensureHomeThumbnail } from "@/lib/card-thumbnail-core.js";
import { existingStudioFile, studioImageUrl } from "@/lib/studio-images";
import { readFile } from "node:fs/promises";
import type { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { showcaseOrderBy, toShowcaseWhere } from "@/lib/showcase";
import { normalizeRecapSpec, recapActivity, representativeIds } from "@/lib/collection-recap";
import { recapActivitySelect, recapWhere } from "@/lib/collection-recap-service";
import { accountStatus } from "@/lib/account-server";

const batchSize = 500;
const responseOptions = { headers: { "Cache-Control": "no-store" } };
const galleryCardSelect = {
  id: true, playerName: true, cardTitle: true,
  year: true, brand: true, productLine: true, parallel: true, gradingCompany: true,
  grade: true, serialNumber: true, serialRange: true,
  images: {
    take: 5, orderBy: cardImageOrder,
    select: { id: true, path: true, rotation: true }
  }
} satisfies Prisma.CardSelect;

function hasGalleryImages(card: { id: string }): card is Prisma.CardGetPayload<{ select: typeof galleryCardSelect }> {
  return "images" in card && "cardTitle" in card;
}

export async function GET(request: NextRequest) {
  try {
    const account = await accountStatus();
    if (!account.authenticated && !account.guest) return NextResponse.json({ error: "login-required" }, { ...responseOptions, status: 401 });
    const guest = account.guest === true;
    const params = request.nextUrl.searchParams;
    const rawSpec = params.get("spec");
    const rawIds = params.get("ids");
    if (guest && (rawSpec !== null || rawIds !== null || params.has("excludeSold"))) {
      return NextResponse.json({ error: "guest-read-only" }, { ...responseOptions, status: 403 });
    }
    const spec = rawSpec === null ? undefined : normalizeRecapSpec(JSON.parse(rawSpec));
    const id = params.get("id");
    const cursor = params.get("cursor");
    const scope = spec ? recapWhere(spec) : toShowcaseWhere({
      q: params.get("q")?.slice(0, 160), group: params.get("group")?.slice(0, 160)
    }, guest);
    const conditions: Prisma.CardWhereInput[] = [scope];
    if (guest && cursor && !id && !await prisma.card.findFirst({ where: { AND: [scope, { id: cursor }] }, select: { id: true } })) {
      return NextResponse.json({ ids: [], nextCursor: null }, responseOptions);
    }
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
    const select = id ? { ...galleryCardSelect, collectionStatus: !guest } : { id: true as const };
    const revision = id || guest ? undefined : (await prisma.dataRevision.findUniqueOrThrow({ where: { id: 1 } })).revision.toString();

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
      const card = matching[0];
      if (card && hasGalleryImages(card) && params.has("studio")) {
        const file = await existingStudioFile(card);
        if (params.get("studio") === "thumbnail") {
          if (!file) return new Response(null, { status: 404 });
          const thumb = path.join(getThumbnailsDir(), "studio", path.basename(file) + ".webp");
          await ensureHomeThumbnail(file, thumb);
          return new Response(new Uint8Array(await readFile(thumb)), { headers: { "Content-Type": "image/webp", "Cache-Control": "private, no-store" } });
        }
        if (params.get("studio") === "png") {
          if (!file) return new Response(null, { status: 404 });
          return new Response(new Uint8Array(await readFile(file)), { headers: { "Content-Type": "image/png", "Cache-Control": "private, no-store" } });
        }
        const images = file ? [{ id: "studio-" + card.images[0].id, path: studioImageUrl(id), rotation: 0 }] : card.images.slice(0, 1);
        return NextResponse.json({ card: { ...card, images } }, responseOptions);
      }
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
