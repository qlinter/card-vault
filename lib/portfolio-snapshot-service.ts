import "server-only";
import { setImmediate as yieldToRequests } from "node:timers/promises";
import { buildCardFilters } from "./card-helpers";
import { portfolioAnalysisCardSelect } from "./card-query-shapes";
import { buildPortfolioScope, normalizePortfolioFilterInput, type PortfolioSnapshot } from "./portfolio-analysis";
import { prisma } from "./prisma";
import type { PortfolioQualityCard } from "./portfolio-quality";
import { type PortfolioCostPosition, type PortfolioFinancialHistoryPoint, type PortfolioSoldReview, type PortfolioValuationChange } from "./portfolio-insights";
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
  asOf?: Date;
  allowEmpty?: boolean;
  includeDetails?: boolean;
  onReportingBatch?: NonNullable<Parameters<typeof createPortfolioBatchAccumulator>[4]>["onReportingBatch"];
};
export async function loadPortfolioSnapshot(value: unknown, options: LoadPortfolioSnapshotOptions = {}): Promise<PortfolioSnapshotResult> {
  const query = normalizePortfolioFilterInput(value);
  const where = buildCardFilters(query);
  const startedAt = performance.now();
  const asOf = options.asOf ?? new Date();
  const [cardCount, config, dates] = await Promise.all([
    prisma.card.count({ where }), loadFinancialSettings(),
    options.includeDetails === false ? [] : prisma.$queryRaw<Array<{
      earliest: number | null;
    }>> `SELECT MIN(at) earliest FROM (
   SELECT CASE WHEN typeof(occurredAt)='integer' THEN occurredAt ELSE CAST(strftime('%s',occurredAt) AS INTEGER)*1000 END at FROM CardTransaction
   UNION ALL SELECT CASE WHEN typeof(occurredAt)='integer' THEN occurredAt ELSE CAST(strftime('%s',occurredAt) AS INTEGER)*1000 END FROM CardExpense
   UNION ALL SELECT CASE WHEN typeof(valuedAt)='integer' THEN valuedAt ELSE CAST(strftime('%s',valuedAt) AS INTEGER)*1000 END FROM CardValuation
  ) WHERE at <= ${asOf.getTime()}`
  ]);
  if (cardCount === 0 && !options.allowEmpty) {
    throw new Error("当前筛选范围内没有可分析的卡片。");
  }
  const earliest = dates[0]?.earliest;
  const accumulator = createPortfolioBatchAccumulator(buildPortfolioScope(query), config, asOf, earliest === null || earliest === undefined ? undefined : new Date(Number(earliest)).toISOString().slice(0, 7), options);
  let queryMs = performance.now() - startedAt, computeMs = 0, cursor: string | undefined;
  let batches = 0, maxBatchRecords = 0;
  for (;;) {
    // Give streaming responses, navigation and other local requests a turn between batches.
    await yieldToRequests();
    const queryStart = performance.now();
    const page = await prisma.card.findMany({ where, select: portfolioAnalysisCardSelect, orderBy: { id: "asc" }, take: 250, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}) });
    queryMs += performance.now() - queryStart;
    const computeStart = performance.now();
    accumulator.add(page.map(card => ({ ...card, imageCount: card._count.images })));
    computeMs += performance.now() - computeStart;
    batches++;
    maxBatchRecords = Math.max(maxBatchRecords, page.reduce((sum, card) => sum + card.transactions.length + card.expenses.length + card.valuations.length, 0));
    if (page.length < 250)
      break;
    cursor = page.at(-1)!.id;
  }
  const finalizeStart = performance.now();
  const result = accumulator.finish();
  if (process.env.CARD_VAULT_PROFILE_PORTFOLIO === "1")
    console.info(JSON.stringify({ event: "portfolio-profile", cards: result.snapshot.cardCount, batches, maxBatchRecords, queryMs: Math.round(queryMs), computeMs: Math.round(computeMs), finalizeMs: Math.round(performance.now() - finalizeStart), totalMs: Math.round(performance.now() - startedAt) }));
  return { ...result, query };
}
export async function loadPortfolioSummary(value: unknown, options: {
  allowEmpty?: boolean;
} = {}) {
  const { snapshot, query } = await loadPortfolioSnapshot(value, { ...options, includeDetails: false });
  return { snapshot, query };
}
