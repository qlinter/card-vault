import { NextRequest, NextResponse } from "next/server";
import { loadScout, mutateScout } from "@/lib/scout-service";
import { prisma } from "@/lib/prisma";
import { scoutCardData, scoutCardSelect } from "@/lib/scout-card-data";
import { buildCardFilters } from "@/lib/card-helpers";
export async function GET(request: NextRequest) {
  try {
    if (request.nextUrl.searchParams.has("wishCards")) {
      const plan = await prisma.collectionPlan.findUnique({ where: { id: request.nextUrl.searchParams.get("wishCards")! }, include: { scoutDetails: true, acquiredCards: { orderBy: { cardId: "asc" }, select: { card: { select: scoutCardSelect } } } } });
      if (!plan) return NextResponse.json({ error: "心愿不存在。" }, { status: 404 });
      return NextResponse.json({ cards: plan.acquiredCards.map(link => scoutCardData(link.card)), status: plan.status, targetCount: plan.scoutDetails?.targetCount ?? null });
    }
    if (request.nextUrl.searchParams.has("cards")) {
      const q = request.nextUrl.searchParams.get("cards")?.slice(0, 200) ?? "";
      const where = { AND: [buildCardFilters({ q }), { collectionStatus: { not: "sold" }, holdingQuantity: { gt: 0 } }] };
      const requestedPage = Math.max(1, Math.min(1000000, Math.floor(Number(request.nextUrl.searchParams.get("page")) || 1))), pageSize = 12;
      const totalCount = await prisma.card.count({ where });
      const page = Math.min(requestedPage, Math.max(1, Math.ceil(totalCount / pageSize)));
      const rows = await prisma.card.findMany({ where, skip: (page - 1) * pageSize, take: pageSize, orderBy: [{ createdAt: "desc" }, { id: "desc" }], select: scoutCardSelect });
      const cards = rows.map(scoutCardData);
      return NextResponse.json({ cards, totalCount, page, pageSize });
    }
    const params = request.nextUrl.searchParams;
    return NextResponse.json(await loadScout({ window: params.get("window") === "1", search: params.get("q")?.slice(0, 500), wishSearch: params.get("wishQ")?.slice(0, 500), wishSort: params.get("wishSort") ?? "priority", watchPage: Number(params.get("watchPage")), wishPage: Number(params.get("wishPage")), cancelledPage: Number(params.get("cancelledPage")), showAcquired: params.get("acquired") === "1" }));
  } catch { return NextResponse.json({ error: "寻卡数据加载失败，请重试。" }, { status: 500 }); }
}
export async function POST(request: NextRequest) {
  try {
    const raw = await request.text();
    if (raw.length > 40000) throw new Error("提交内容过长。");
    const body = JSON.parse(raw);
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("提交内容无效。");
    return NextResponse.json(await mutateScout(body));
  } catch (error) {
    const message = error instanceof Error && !error.message.includes("prisma.") && !error.message.includes("Invocation") ? error.message : "保存失败，请刷新后重试。";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
