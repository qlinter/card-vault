import "server-only";

import { buildCardFilters } from "./card-helpers";
import { portfolioAnalysisCardSelect } from "./card-query-shapes";
import {
  buildPortfolioScope,
  buildPortfolioSnapshot,
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

export const maximumPortfolioCardCount = 5000;

export type { PortfolioQualityCard } from "./portfolio-quality";

export type PortfolioSnapshotResult = {
  snapshot: PortfolioSnapshot;
  qualityCards: PortfolioQualityCard[];
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
  return prisma.card.findMany({ where, select: portfolioAnalysisCardSelect });
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
  if (cardCount > maximumPortfolioCardCount) {
    throw new Error(`当前筛选结果超过 ${maximumPortfolioCardCount} 张，请缩小范围后重试。`);
  }

  const asOf = new Date();
  const cards = await queryPortfolioCards(where);
  const portfolioCards = cards.map((card) => ({ ...card, imageCount: card._count.images }));
  const snapshot = buildPortfolioSnapshot(
    portfolioCards,
    buildPortfolioScope(query),
    asOf
  );
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

  return { snapshot, qualityCards, query, valuationChanges, financialHistory, highCostPositions, soldReviews };
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
