import "server-only";

import { buildCardFilters } from "./card-helpers";
import { portfolioAnalysisCardSelect } from "./card-query-shapes";
import {
  buildPortfolioScope,
  normalizePortfolioFilterInput,
  type PortfolioSnapshot
} from "./portfolio-analysis";
import { prisma } from "./prisma";
import type { PortfolioQualityCard } from "./portfolio-quality";
import {
  buildPortfolioComparisonPoint,
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
import { createPortfolioBatchAccumulator } from "./portfolio-batch";


export type { PortfolioQualityCard } from "./portfolio-quality";

export type PortfolioSnapshotResult = {
  snapshot: PortfolioSnapshot;
  qualityCards: PortfolioQualityCard[];
  incompleteCards: ReturnType<ReturnType<typeof createPortfolioBatchAccumulator>["finish"]>["incompleteCards"];
  query: PortfolioFilterInput;
  valuationChanges: PortfolioValuationChange[];
  financialHistory: PortfolioFinancialHistoryPoint[];
  highCostPositions: PortfolioCostPosition[];
  soldReviews: PortfolioSoldReview[];
};

type LoadPortfolioSnapshotOptions = {
  allowEmpty?: boolean;
};

export async function loadPortfolioSnapshot(
  value: unknown,
  options: LoadPortfolioSnapshotOptions = {}
): Promise<PortfolioSnapshotResult> {
  const query = normalizePortfolioFilterInput(value);
  const where = buildCardFilters(query);
  const startedAt = performance.now();
  const asOf = new Date();
  const [cardCount, config, dates] = await Promise.all([
    prisma.card.count({ where }), loadFinancialSettings(),
    prisma.$queryRaw<Array<{ earliest: number | null }>>`SELECT MIN(at) earliest FROM (
      SELECT CASE WHEN typeof(occurredAt)='integer' THEN occurredAt ELSE CAST(strftime('%s',occurredAt) AS INTEGER)*1000 END at FROM CardTransaction
      UNION ALL SELECT CASE WHEN typeof(occurredAt)='integer' THEN occurredAt ELSE CAST(strftime('%s',occurredAt) AS INTEGER)*1000 END FROM CardExpense
      UNION ALL SELECT CASE WHEN typeof(valuedAt)='integer' THEN valuedAt ELSE CAST(strftime('%s',valuedAt) AS INTEGER)*1000 END FROM CardValuation
    ) WHERE at <= ${asOf.getTime()}`
  ]);

  if (cardCount === 0 && !options.allowEmpty) {
    throw new Error("当前筛选范围内没有可分析的卡片。");
  }


  const earliest = dates[0]?.earliest;
  const accumulator = createPortfolioBatchAccumulator(buildPortfolioScope(query), config, asOf, earliest === null || earliest === undefined ? undefined : new Date(Number(earliest)).toISOString().slice(0, 7));
  let queryMs = performance.now() - startedAt, computeMs = 0, cursor: string | undefined;
  let batches = 0, maxBatchRecords = 0;
  for (;;) {
    const queryStart = performance.now();
    const page = await prisma.card.findMany({ where, select: portfolioAnalysisCardSelect, orderBy: { id: "asc" }, take: 250, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}) });
    queryMs += performance.now() - queryStart;
    const computeStart = performance.now();
    accumulator.add(page.map(card => ({ ...card, imageCount: card._count.images })));
    computeMs += performance.now() - computeStart;
    batches++; maxBatchRecords = Math.max(maxBatchRecords, page.reduce((sum, card) => sum + card.transactions.length + card.expenses.length + card.valuations.length, 0));
    if (page.length < 250) break;
    cursor = page.at(-1)!.id;
  }
  const finalizeStart = performance.now();
  const result = accumulator.finish();
  if (process.env.CARD_VAULT_PROFILE_PORTFOLIO === "1") console.info(JSON.stringify({ event: "portfolio-profile", cards: result.snapshot.cardCount, batches, maxBatchRecords, queryMs: Math.round(queryMs), computeMs: Math.round(computeMs), finalizeMs: Math.round(performance.now() - finalizeStart), totalMs: Math.round(performance.now() - startedAt) }));
  return { ...result, query };
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
