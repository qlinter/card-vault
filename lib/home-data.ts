import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { buildCardFilters, buildCardSorting, splitTagString } from "./card-helpers";
import { ensureCardReports } from "./card-report-index";
import { homeThumbnailPublicPath } from "./card-thumbnail-core.js";

export const homePageSize = 24;
export const optionFields = ["sport", "team", "year", "brand", "productLine", "subsetName", "parallel", "gradingCompany", "grade", "autoType", "patchType"] as const;
type Query = Parameters<typeof buildCardFilters>[0];

export async function loadHomeData(query: Query, page = 0, attempt = 0): Promise<{ cards: Array<{ id: string; playerName: string; cardTitle: string; details: string; tags: string[]; imagePath: string | null; imageRotation: number; href: string }>; totalCount: number; currency: string; totalValue: string | null; valuedCount: number }> {
  await ensureCardReports();
  const where = buildCardFilters(query);
  const financialSort = /^(?:price|costCny|valueCny)(?:Asc|Desc)$/.test(query.sort ?? "");
  const orderBy: Prisma.CardOrderByWithRelationInput[] = financialSort
    ? [{ report: { [query.sort?.startsWith("value") ? "valueMinor" : "remainingCostMinor"]: { sort: query.sort?.endsWith("Desc") ? "desc" : "asc", nulls: "last" } } }, { id: "asc" }]
    : [...buildCardSorting(query.sort), { id: "asc" }];
  const [cards, totalCount, summary, settings, meta] = await prisma.$transaction([
    prisma.card.findMany({ where, take: homePageSize, skip: Math.max(0, Math.trunc(page)) * homePageSize, orderBy, select: { id: true, playerName: true, cardTitle: true, year: true, team: true, productLine: true, tags: true, images: { take: 1, orderBy: { createdAt: "asc" }, select: { path: true, rotation: true } } } }),
    prisma.card.count({ where }),
    prisma.cardReport.aggregate({ where: { card: where }, _sum: { valueMinor: true }, _count: { valueMinor: true } }),
    prisma.financialSettings.findUnique({ where: { id: "default" } }),
    prisma.dataRevision.findUniqueOrThrow({ where: { id: 1 } })
  ]);
  if (meta.revision !== meta.projectionRevision) {
    if (attempt >= 2) throw new Error("收藏数据正在连续变化，请稍后刷新。");
    return loadHomeData(query, page, attempt + 1);
  }
  const params = new URLSearchParams(Object.entries(query).filter((entry): entry is [string, string] => Boolean(entry[1])));
  const returnTo = params.size ? `/?${params}` : "/";
  return {
    cards: cards.map(card => ({ id: card.id, playerName: card.playerName, cardTitle: card.cardTitle, details: [card.year, card.team, card.productLine].filter(Boolean).join(" / "), tags: splitTagString(card.tags).slice(0, 4), imagePath: card.images[0] ? homeThumbnailPublicPath(card.images[0].path) : null, imageRotation: card.images[0]?.rotation ?? 0, href: `/cards/${card.id}?returnTo=${encodeURIComponent(returnTo)}` })),
    totalCount, currency: settings?.reportingCurrency ?? "CNY",
    totalValue: summary._sum.valueMinor?.toString() ?? null, valuedCount: summary._count.valueMinor
  };
}

export async function loadHomeOptions() {
  const entries = await Promise.all(optionFields.map(async field => {
    const rows = await prisma.card.groupBy({ by: [field] });
    return [field, rows.flatMap(row => { const value = row[field]; return value ? [value] : []; }).sort((a, b) => a.localeCompare(b))];
  }));
  return Object.fromEntries(entries) as Record<typeof optionFields[number], string[]>;
}
