import { mergePortfolioFinancials, finishPortfolioFinancials } from "./portfolio-batch-financials.ts";
import { createPortfolioHistoryAccumulator } from "./portfolio-batch-history.ts";
import { mergeGroups, finalizeAllocation, mergeSeries } from "./portfolio-batch-groups.ts";
import { compareCollectionStatuses } from "./card-domain.ts";
import { concentrationDimension } from "./portfolio-analysis-statistics.ts";
import type { PortfolioBreakdown, PortfolioCardRecord, PortfolioScope, PortfolioSnapshot } from "./portfolio-analysis-types.ts";
import type { FinancialConfig } from "./financial-reporting.ts";
import { buildReportingPortfolio } from "./portfolio-reporting.ts";
import { buildPortfolioPositionReviews, buildPortfolioValuationChanges } from "./portfolio-insights.ts";
import { buildPortfolioQualityCards } from "./portfolio-quality.ts";
import { roundPortfolioValue as money } from "./portfolio-number.ts";
/** Only aggregate results survive each batch; transaction and valuation arrays are released. */
export function createPortfolioBatchAccumulator(scope: PortfolioScope, config: FinancialConfig, asOf: Date, startMonth?: string, options: {
  includeDetails?: boolean;
} = {}) {
  const empty = buildReportingPortfolio([], scope, config, asOf);
  const snapshot = empty.snapshot;
  const qualityCards: ReturnType<typeof buildPortfolioQualityCards> = [];
  const incompleteCards: typeof empty.incompleteCards = [];
  const valuationChanges = buildPortfolioValuationChanges([], asOf);
  const history = createPortfolioHistoryAccumulator(asOf, startMonth);
  const reviews = buildPortfolioPositionReviews([]);
  const players = new Set<string>();
  const rates = new Map<string, NonNullable<PortfolioSnapshot["accounting"]>["rates"][number]>();
  const missing = new Set<string>();
  let completeness = 0;
  let incompleteCosts = false;
  function add(cards: PortfolioCardRecord[]) {
    const reporting = buildReportingPortfolio(cards, scope, config, asOf, { allGroups: true });
    incompleteCosts ||= reporting.cards.some(card => card.costMissing.length > 0);
    const part = reporting.snapshot;
    for (const card of cards) {
      if (card.playerName.trim())
        players.add(card.playerName.trim());
      completeness += card.playerName && card.sport && card.cardTitle ? 100 : 66.67;
    }
    for (const key of ["cardCount", "activeCount", "soldCount", "pendingGradingCount"] as const)
      snapshot[key] += part[key];
    mergePortfolioFinancials(snapshot.financials, part.financials);
    for (const key of ["gradedCount", "rookieCount", "autographCount", "patchCount", "serialNumberedCount"] as const)
      snapshot.quality[key] += part.quality[key];
    for (const key of ["autoTypes", "patchTypes"] as const)
      snapshot.quality[key] = mergeGroups(snapshot.quality[key], part.quality[key]);
    for (const key of Object.keys(snapshot.allocation) as Array<keyof typeof snapshot.allocation>)
      snapshot.allocation[key] = mergeGroups(snapshot.allocation[key], part.allocation[key]);
    for (const key of ["sports", "players", "statuses"] as const)
      snapshot[key] = mergeGroups(snapshot[key], part[key]);
    for (const key of ["imageCount", "imageCoverageCount", "publicDescriptionCoverageCount", "incompleteCardCount"] as const)
      snapshot.coverage[key] += part.coverage[key];
    for (const key of Object.keys(snapshot.timeSeries) as Array<keyof typeof snapshot.timeSeries>)
      snapshot.timeSeries[key] = mergeSeries(snapshot.timeSeries[key], part.timeSeries[key]);
    for (const key of Object.keys(snapshot.activitySeries) as Array<keyof typeof snapshot.activitySeries>)
      snapshot.activitySeries[key] = mergeSeries(snapshot.activitySeries[key], part.activitySeries[key]);
    for (const item of part.attentionItems) {
      const current = snapshot.attentionItems.find(row => row.type === item.type);
      if (current)
        current.count += item.count;
      else
        snapshot.attentionItems.push({ ...item });
    }
    snapshot.topPositions = [...snapshot.topPositions, ...part.topPositions].sort((a, b) => b.latestValue - a.latestValue).slice(0, 10);
    snapshot.accounting!.incompleteCardCount += part.accounting!.incompleteCardCount;
    for (const reason of part.accounting!.missing)
      missing.add(reason);
    for (const rate of part.accounting!.rates)
      rates.set(rate.id, rate);
    if (options.includeDetails === false)
      return;
    incompleteCards.push(...reporting.incompleteCards);
    qualityCards.push(...buildPortfolioQualityCards(cards.map(card => ({ id: card.id ?? "", playerName: card.playerName, cardTitle: card.cardTitle ?? "", sport: card.sport, imageCount: card.imageCount ?? 0, transactionCount: card.transactions.length, valuations: card.valuations })), asOf));
    history.add(reporting.cards);
    const changes = buildPortfolioValuationChanges(reporting.cards, asOf);
    for (const [index, change] of changes.entries())
      for (const row of change.currencies) {
        const current = valuationChanges[index].currencies.find(item => item.currency === row.currency);
        if (!current)
          valuationChanges[index].currencies.push({ ...row });
        else
          for (const key of ["currentValue", "baselineValue", "currentValuedCardCount", "baselineValuedCardCount"] as const)
            current[key] = money(current[key] + row[key]);
      }
    const batchReviews = buildPortfolioPositionReviews(reporting.cards, reporting.cardFacts);
    reviews.highCostPositions.push(...batchReviews.highCostPositions);
    reviews.soldReviews.push(...batchReviews.soldReviews);
    // Keep only candidates that can appear in the final rankings.
    reviews.highCostPositions = [...new Set(reviews.highCostPositions.map(item => item.currency))].sort().flatMap(currency => reviews.highCostPositions.filter(item => item.currency === currency).sort((a, b) => b.remainingCost - a.remainingCost).slice(0, 10));
    reviews.soldReviews = [...new Set(reviews.soldReviews.map(item => item.currency))].sort().flatMap(currency => reviews.soldReviews.filter(item => item.currency === currency).sort((a, b) => Number(a.needsSaleRecord) - Number(b.needsSaleRecord) || (b.soldAt ?? "").localeCompare(a.soldAt ?? "") || b.netSaleAmount - a.netSaleAmount).slice(0, 20));
  }
  function finish() {
    snapshot.playerCount = players.size;
    snapshot.coverage.coreFieldCompletenessAverage = snapshot.cardCount ? money(completeness / snapshot.cardCount) : 0;
    finishPortfolioFinancials(snapshot.financials, incompleteCosts, snapshot.accounting!.incompleteCardCount > 0);
    for (const key of Object.keys(snapshot.allocation) as Array<keyof typeof snapshot.allocation>)
      finalizeAllocation(snapshot.allocation[key], snapshot.cardCount);
    snapshot.allocation.byStatus.sort((a, b) => compareCollectionStatuses(a.name, b.name));
    snapshot.quality.gradingCompanies = snapshot.allocation.byGradingCompany;
    snapshot.quality.grades = snapshot.allocation.byGrade;
    finalizeAllocation(snapshot.quality.autoTypes, snapshot.quality.autographCount);
    finalizeAllocation(snapshot.quality.patchTypes, snapshot.quality.patchCount);
    snapshot.concentration = { player: concentrationDimension(snapshot.allocation.byPlayer), sport: concentrationDimension(snapshot.allocation.bySport), team: concentrationDimension(snapshot.allocation.byTeam), brand: concentrationDimension(snapshot.allocation.byBrand), productLine: concentrationDimension(snapshot.allocation.byProductLine) };
    const groupOrder = (a: PortfolioBreakdown, b: PortfolioBreakdown) => b.count - a.count || (b.values.CNY ?? 0) - (a.values.CNY ?? 0) || (b.values.USD ?? 0) - (a.values.USD ?? 0) || a.name.localeCompare(b.name);
    snapshot.sports.sort(groupOrder);
    snapshot.sports = snapshot.sports.slice(0, 10);
    snapshot.players.sort(groupOrder);
    snapshot.players = snapshot.players.slice(0, 12);
    snapshot.statuses.sort((a, b) => compareCollectionStatuses(a.name, b.name));
    const attentionOrder = ["missing_valuation", "stale_valuation", "missing_transaction", "missing_image", "incomplete_data"];
    snapshot.attentionItems.sort((a, b) => attentionOrder.indexOf(a.type) - attentionOrder.indexOf(b.type));
    snapshot.accounting!.missing = [...missing];
    snapshot.accounting!.rates = [...rates.values()];
    const severity = { high: 0, medium: 1, low: 2 };
    qualityCards.sort((a, b) => severity[a.severity] - severity[b.severity] || b.issues.length - a.issues.length || a.playerName.localeCompare(b.playerName));
    for (const change of valuationChanges) {
      change.currencies.sort((a, b) => a.currency.localeCompare(b.currency));
      for (const row of change.currencies) {
        row.changeAmount = money(row.currentValue - row.baselineValue);
        row.changeRate = row.baselineValue > 0 ? money(row.changeAmount / row.baselineValue * 100) : null;
      }
    }
    const financialHistory = history.finish();
    return { snapshot, qualityCards, incompleteCards, valuationChanges, financialHistory, ...reviews };
  }
  return { add, finish };
}
