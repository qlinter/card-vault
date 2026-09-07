import "server-only";

import { buildCardFilters } from "./card-helpers";
import { portfolioAnalysisCardSelect } from "./card-query-shapes";
import {
  buildPortfolioScope,
  normalizePortfolioFilterInput,
  type PortfolioSnapshot
} from "./portfolio-analysis";
import { prisma } from "./prisma";
import { buildPortfolioQualityCards, type PortfolioQualityCard } from "./portfolio-quality";
import {
  buildPortfolioComparisonPoint,
  buildPortfolioFinancialHistory,
  buildPortfolioPositionReviews,
  buildPortfolioValuationChanges,
  type PortfolioComparison,
  type PortfolioComparisonPoint,
  type PortfolioCostPosition,
  type PortfolioFinancialHistoryPoint,
  type PortfolioSoldReview,
  type PortfolioValuationChange
} from "./portfolio-insights";
import { getSavedPortfolioView, getStoredPortfolioSnapshot } from "./portfolio-persistence";
import type { PortfolioFilterInput } from "./portfolio-analysis";
import { loadFinancialSettings } from "./financial-settings";
import { buildReportingPortfolio } from "./portfolio-reporting";


export type { PortfolioQualityCard } from "./portfolio-quality";

export type PortfolioSnapshotResult = {
  snapshot: PortfolioSnapshot;
  qualityCards: PortfolioQualityCard[];
  incompleteCards: ReturnType<typeof buildReportingPortfolio>["incompleteCards"];
  query: PortfolioFilterInput;
  valuationChanges: PortfolioValuationChange[];
  financialHistory: PortfolioFinancialHistoryPoint[];
  highCostPositions: PortfolioCostPosition[];
  soldReviews: PortfolioSoldReview[];
};

type LoadPortfolioSnapshotOptions = {
  allowEmpty?: boolean;
};

async function queryPortfolioCards(where: ReturnType<typeof buildCardFilters>) {
  const cards = [];
  let cursor: string | undefined;
  for (;;) {
    const page = await prisma.card.findMany({ where, select: portfolioAnalysisCardSelect, orderBy: { id: "asc" }, take: 250, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}) });
    cards.push(...page);
    if (page.length < 250) return cards;
    cursor = page.at(-1)!.id;
  }
}

export async function loadPortfolioSnapshot(
  value: unknown,
  options: LoadPortfolioSnapshotOptions = {}
): Promise<PortfolioSnapshotResult> {
  const query = normalizePortfolioFilterInput(value);
  const where = buildCardFilters(query);
  const cardCount = await prisma.card.count({ where });

  if (cardCount === 0 && !options.allowEmpty) {
    throw new Error("当前筛选范围内没有可分析的卡片。");
  }


  const asOf = new Date();
  const cards = await queryPortfolioCards(where);
  const config = await loadFinancialSettings();
  const { snapshot, cards: portfolioCards, incompleteCards } = buildReportingPortfolio(
    cards.map((card) => ({ ...card, imageCount: card._count.images })), buildPortfolioScope(query), config, asOf);
  const qualityCards = buildPortfolioQualityCards(cards.map((card) => ({
    id: card.id,
    playerName: card.playerName,
    cardTitle: card.cardTitle,
    sport: card.sport,
    imageCount: card._count.images,
    transactionCount: card.transactions.length,
    valuations: card.valuations
  })), asOf);
  const valuationChanges = buildPortfolioValuationChanges(portfolioCards, asOf);
  const financialHistory = buildPortfolioFinancialHistory(portfolioCards, asOf);
  const { highCostPositions, soldReviews } = buildPortfolioPositionReviews(portfolioCards);

  return { snapshot, qualityCards, incompleteCards, query, valuationChanges, financialHistory, highCostPositions, soldReviews };
}

async function loadComparisonPoint(
  token: string,
  current: PortfolioSnapshotResult
): Promise<PortfolioComparisonPoint> {
  if (token === "current") {
    return buildPortfolioComparisonPoint(current.snapshot, "当前范围");
  }
  if (token.startsWith("view:")) {
    const view = await getSavedPortfolioView(token.slice(5));
    if (!view) throw new Error("用于比较的收藏视图不存在或已删除。");
    const result = await loadPortfolioSnapshot(view.query, { allowEmpty: true });
    return buildPortfolioComparisonPoint(result.snapshot, `视图：${view.name}`);
  }
  if (token.startsWith("snapshot:")) {
    const stored = await getStoredPortfolioSnapshot(token.slice(9));
    if (!stored) throw new Error("用于比较的时间点快照不存在或已删除。");
    if (!stored.snapshot.accounting || stored.snapshot.accounting.version !== current.snapshot.accounting?.version || stored.snapshot.accounting.currency !== current.snapshot.accounting?.currency) {
      throw new Error("快照的核算版本或报表币种不同，不能直接比较。请使用相同口径重新保存快照。");
    }
    return buildPortfolioComparisonPoint(stored.snapshot, `快照：${stored.record.name}`, new Date(stored.record.capturedAt));
  }
  throw new Error("组合比较来源无效。");
}

export async function loadPortfolioComparison(
  leftToken: string | undefined,
  rightToken: string | undefined,
  current: PortfolioSnapshotResult
): Promise<PortfolioComparison | null> {
  if (!leftToken || !rightToken) return null;
  const [left, right] = await Promise.all([
    loadComparisonPoint(leftToken, current),
    loadComparisonPoint(rightToken, current)
  ]);
  return { left, right };
}
