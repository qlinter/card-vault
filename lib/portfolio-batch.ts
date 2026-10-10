import { compareCollectionStatuses } from "./card-domain.ts";
import { concentrationDimension } from "./portfolio-analysis-statistics.ts";
import type { PortfolioAllocationBreakdown, PortfolioBreakdown, PortfolioCardRecord, PortfolioScope, PortfolioSnapshot, PortfolioTimeSeriesPoint } from "./portfolio-analysis-types.ts";
import type { FinancialConfig } from "./financial-reporting.ts";
import { buildReportingPortfolio } from "./portfolio-reporting.ts";
import { buildPortfolioFinancialHistory, buildPortfolioPositionReviews, buildPortfolioValuationChanges, type PortfolioFinancialHistoryPoint } from "./portfolio-insights.ts";
import { buildPortfolioQualityCards } from "./portfolio-quality.ts";
import { roundPortfolioValue as money } from "./portfolio-number.ts";

function mergeGroups<T extends PortfolioBreakdown & { valuedCount?: number }>(left: T[], right: T[]): T[] {
  const groups = new Map(left.map(item => [item.name, item]));
  for (const item of right) {
    const current = groups.get(item.name);
    if (!current) { groups.set(item.name, { ...item, values: { ...item.values } }); continue; }
    current.count += item.count;
    for (const [currency, value] of Object.entries(item.values)) current.values[currency] = money((current.values[currency] ?? 0) + value);
    if (current.valuedCount !== undefined && item.valuedCount !== undefined) current.valuedCount += item.valuedCount;
  }
  return [...groups.values()];
}

function finalizeAllocation(items: PortfolioAllocationBreakdown[], count: number) {
  const totals: Record<string, number> = {};
  for (const item of items) for (const [currency, value] of Object.entries(item.values)) totals[currency] = money((totals[currency] ?? 0) + value);
  for (const item of items) {
    item.countShare = money(item.count / (count || 1) * 100);
    item.valueShare = {}; item.averageValue = {};
    for (const [currency, value] of Object.entries(item.values)) {
      item.valueShare[currency] = totals[currency] > 0 ? money(value / totals[currency] * 100) : 0;
      item.averageValue[currency] = item.valuedCount > 0 ? money(value / item.valuedCount) : 0;
    }
  }
  return items.sort((a, b) => b.count - a.count || (b.valueShare.CNY ?? 0) - (a.valueShare.CNY ?? 0) || a.name.localeCompare(b.name));
}

function mergeSeries(left: PortfolioTimeSeriesPoint[], right: PortfolioTimeSeriesPoint[]) {
  const points = new Map(left.map(item => [item.month, item]));
  for (const item of right) {
    const current = points.get(item.month) ?? { month: item.month, count: 0, values: {} };
    current.count += item.count;
    for (const [currency, value] of Object.entries(item.values)) current.values[currency] = money((current.values[currency] ?? 0) + value);
    const missing = [...new Set([...(current.missingCurrencies ?? []), ...(item.missingCurrencies ?? [])])];
    if (missing.length) { current.missingCurrencies = missing; for (const currency of missing) delete current.values[currency]; }
    points.set(item.month, current);
  }
  return [...points.values()].sort((a, b) => a.month.localeCompare(b.month));
}

const sumOrMissing = (left: number | null, right: number | null) => left === null || right === null ? null : money(left + right);
type HistoryTotal = PortfolioFinancialHistoryPoint["currencies"][number] & { quotedProfitMissing: boolean };
type HistoryPoint = Omit<PortfolioFinancialHistoryPoint, "currencies"> & { currencies: HistoryTotal[] };

/** Only aggregate results survive each batch; transaction and valuation arrays are released. */
export function createPortfolioBatchAccumulator(scope: PortfolioScope, config: FinancialConfig, asOf: Date, startMonth?: string) {
  const empty = buildReportingPortfolio([], scope, config, asOf);
  const snapshot = empty.snapshot;
  const qualityCards: ReturnType<typeof buildPortfolioQualityCards> = [];
  const incompleteCards: typeof empty.incompleteCards = [];
  const valuationChanges = buildPortfolioValuationChanges([], asOf);
  const history = new Map<string, HistoryPoint>();
  const reviews = buildPortfolioPositionReviews([]);
  const players = new Set<string>();
  const rates = new Map<string, NonNullable<PortfolioSnapshot["accounting"]>["rates"][number]>();
  const missing = new Set<string>();
  let earliest = Infinity;
  let completeness = 0;
  let incompleteCosts = false;

  function add(cards: PortfolioCardRecord[]) {
    const reporting = buildReportingPortfolio(cards, scope, config, asOf, { allGroups: true });
    incompleteCosts ||= reporting.cards.some(card => card.costMissing.length > 0);
    const part = reporting.snapshot;
    for (const card of cards) { if (card.playerName.trim()) players.add(card.playerName.trim()); completeness += card.playerName && card.sport && card.cardTitle ? 100 : 66.67; }
    for (const key of ["cardCount", "activeCount", "soldCount", "pendingGradingCount"] as const) snapshot[key] += part[key];
    const countFields = ["transactionCoverageCount", "expenseCoverageCount", "valuationCoverageCount", "valuationEligibleCount", "freshValuationCount", "staleValuationCount"] as const;
    for (const key of countFields) snapshot.financials[key] += part.financials[key];
    for (const row of part.financials.currencies) {
      const current = snapshot.financials.currencies.find(item => item.currency === row.currency);
      if (!current) { snapshot.financials.currencies.push({ ...row }); continue; }
      for (const key of Object.keys(row) as Array<keyof typeof row>) {
        if (key === "currency" || key === "unrealizedReturnRate") continue;
        current[key] = sumOrMissing(current[key], row[key]) as number;
      }
    }
    for (const key of ["latestValuationAt", "oldestLatestValuationAt"] as const) {
      const value = part.financials[key], previous = snapshot.financials[key];
      if (value && (!previous || (key === "latestValuationAt" ? value > previous : value < previous))) snapshot.financials[key] = value;
    }
    for (const source of part.financials.valuationSources) {
      const current = snapshot.financials.valuationSources.find(item => item.name === source.name);
      if (current) current.count += source.count; else snapshot.financials.valuationSources.push({ ...source });
    }
    for (const key of ["gradedCount", "rookieCount", "autographCount", "patchCount", "serialNumberedCount"] as const) snapshot.quality[key] += part.quality[key];
    for (const key of ["autoTypes", "patchTypes"] as const) snapshot.quality[key] = mergeGroups(snapshot.quality[key], part.quality[key]);
    for (const key of Object.keys(snapshot.allocation) as Array<keyof typeof snapshot.allocation>) snapshot.allocation[key] = mergeGroups(snapshot.allocation[key], part.allocation[key]);
    for (const key of ["sports", "players", "statuses"] as const) snapshot[key] = mergeGroups(snapshot[key], part[key]);
    for (const key of ["imageCount", "imageCoverageCount", "publicDescriptionCoverageCount", "incompleteCardCount"] as const) snapshot.coverage[key] += part.coverage[key];
    for (const key of Object.keys(snapshot.timeSeries) as Array<keyof typeof snapshot.timeSeries>) snapshot.timeSeries[key] = mergeSeries(snapshot.timeSeries[key], part.timeSeries[key]);
    for (const key of Object.keys(snapshot.activitySeries) as Array<keyof typeof snapshot.activitySeries>) snapshot.activitySeries[key] = mergeSeries(snapshot.activitySeries[key], part.activitySeries[key]);
    for (const item of part.attentionItems) { const current = snapshot.attentionItems.find(row => row.type === item.type); if (current) current.count += item.count; else snapshot.attentionItems.push({ ...item }); }
    snapshot.topPositions = [...snapshot.topPositions, ...part.topPositions].sort((a, b) => b.latestValue - a.latestValue).slice(0, 10);
    snapshot.accounting!.incompleteCardCount += part.accounting!.incompleteCardCount;
    for (const reason of part.accounting!.missing) missing.add(reason);
    for (const rate of part.accounting!.rates) rates.set(rate.id, rate);
    incompleteCards.push(...reporting.incompleteCards);
    qualityCards.push(...buildPortfolioQualityCards(cards.map(card => ({ id: card.id ?? "", playerName: card.playerName, cardTitle: card.cardTitle ?? "", sport: card.sport, imageCount: card.imageCount ?? 0, transactionCount: card.transactions.length, valuations: card.valuations })), asOf));
    for (const card of reporting.cards) {
      for (const row of [...card.transactions, ...card.expenses]) earliest = Math.min(earliest, (row.occurredAt ?? row.createdAt ?? new Date(0)).getTime());
      for (const row of card.valuations) earliest = Math.min(earliest, row.valuedAt.getTime());
    }
    for (const point of buildPortfolioFinancialHistory(reporting.cards, asOf, startMonth)) {
      const current = history.get(point.month) ?? { month: point.month, capturedAt: point.capturedAt, currencies: [], coverage: [] };
      for (const total of point.currencies) {
        const counts = point.coverage.find(item => item.currency === total.currency)!;
        const previous = current.currencies.find(item => item.currency === total.currency);
        const quotedProfitMissing = counts.valued > 0 && total.unrealizedProfit === null;
        if (previous) {
          previous.portfolioValue = money((previous.portfolioValue ?? 0) + (total.portfolioValue ?? 0));
          previous.remainingCost = sumOrMissing(previous.remainingCost, total.remainingCost);
          previous.realizedProfit = sumOrMissing(previous.realizedProfit, total.realizedProfit);
          previous.unrealizedProfit = money((previous.unrealizedProfit ?? 0) + (total.unrealizedProfit ?? 0));
          previous.quotedProfitMissing ||= quotedProfitMissing;
        } else current.currencies.push({ ...total, portfolioValue: total.portfolioValue ?? 0, unrealizedProfit: total.unrealizedProfit ?? 0, quotedProfitMissing });
        const coverage = current.coverage.find(item => item.currency === total.currency);
        if (coverage) { coverage.active += counts.active; coverage.valued += counts.valued; coverage.costKnown += counts.costKnown; }
        else current.coverage.push({ ...counts });
      }
      history.set(point.month, current);
    }
    const changes = buildPortfolioValuationChanges(reporting.cards, asOf);
    for (const [index, change] of changes.entries()) for (const row of change.currencies) {
      const current = valuationChanges[index].currencies.find(item => item.currency === row.currency);
      if (!current) valuationChanges[index].currencies.push({ ...row });
      else for (const key of ["currentValue", "baselineValue", "currentValuedCardCount", "baselineValuedCardCount"] as const) current[key] = money(current[key] + row[key]);
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
    snapshot.financials.currencies.sort((a, b) => ["CNY", "USD"].indexOf(a.currency) - ["CNY", "USD"].indexOf(b.currency));
    for (const row of snapshot.financials.currencies) {
      if (incompleteCosts) {
        row.purchaseAmount = row.salesAmount = row.expenseAmount = row.inventoryExpenseAmount = row.saleExpenseAmount = row.netCashInvested = null;
        row.activeCostBasis = row.realizedCost = row.realizedProfit = row.comparableCostBasis = null;
      }
      if (snapshot.accounting!.incompleteCardCount > 0) row.unrealizedDifference = row.unrealizedReturnRate = row.totalProfit = null;
      row.unrealizedReturnRate = row.comparableCostBasis !== null && row.comparableCostBasis > 0 && row.unrealizedDifference !== null ? money(row.unrealizedDifference / row.comparableCostBasis * 100) : null;
    }
    snapshot.financials.valuationSources.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
    for (const key of Object.keys(snapshot.allocation) as Array<keyof typeof snapshot.allocation>) finalizeAllocation(snapshot.allocation[key], snapshot.cardCount);
    snapshot.allocation.byStatus.sort((a, b) => compareCollectionStatuses(a.name, b.name));
    snapshot.quality.gradingCompanies = snapshot.allocation.byGradingCompany; snapshot.quality.grades = snapshot.allocation.byGrade;
    finalizeAllocation(snapshot.quality.autoTypes, snapshot.quality.autographCount); finalizeAllocation(snapshot.quality.patchTypes, snapshot.quality.patchCount);
    snapshot.concentration = { player: concentrationDimension(snapshot.allocation.byPlayer), sport: concentrationDimension(snapshot.allocation.bySport), team: concentrationDimension(snapshot.allocation.byTeam), brand: concentrationDimension(snapshot.allocation.byBrand), productLine: concentrationDimension(snapshot.allocation.byProductLine) };
    const groupOrder = (a: PortfolioBreakdown, b: PortfolioBreakdown) => b.count - a.count || (b.values.CNY ?? 0) - (a.values.CNY ?? 0) || (b.values.USD ?? 0) - (a.values.USD ?? 0) || a.name.localeCompare(b.name);
    snapshot.sports.sort(groupOrder); snapshot.sports = snapshot.sports.slice(0, 10);
    snapshot.players.sort(groupOrder); snapshot.players = snapshot.players.slice(0, 12);
    snapshot.statuses.sort((a, b) => compareCollectionStatuses(a.name, b.name));
    const attentionOrder = ["missing_valuation", "stale_valuation", "missing_transaction", "missing_image", "incomplete_data"];
    snapshot.attentionItems.sort((a, b) => attentionOrder.indexOf(a.type) - attentionOrder.indexOf(b.type));
    snapshot.accounting!.missing = [...missing]; snapshot.accounting!.rates = [...rates.values()];
    const severity = { high: 0, medium: 1, low: 2 };
    qualityCards.sort((a, b) => severity[a.severity] - severity[b.severity] || b.issues.length - a.issues.length || a.playerName.localeCompare(b.playerName));
    for (const change of valuationChanges) {
      change.currencies.sort((a, b) => a.currency.localeCompare(b.currency));
      for (const row of change.currencies) { row.changeAmount = money(row.currentValue - row.baselineValue); row.changeRate = row.baselineValue > 0 ? money(row.changeAmount / row.baselineValue * 100) : null; }
    }
    const firstMonth = earliest === Infinity ? null : new Date(earliest).toISOString().slice(0, 7);
    const financialHistory: PortfolioFinancialHistoryPoint[] = [...history.values()].filter(point => firstMonth !== null && point.month >= firstMonth).sort((a, b) => a.month.localeCompare(b.month)).map(point => ({ ...point, currencies: point.currencies.map(({ quotedProfitMissing, ...row }) => {
      const counts = point.coverage.find(item => item.currency === row.currency)!;
      if (counts.active > 0 && counts.valued === 0) row.portfolioValue = row.unrealizedProfit = null;
      else if (quotedProfitMissing) row.unrealizedProfit = null;
      return row;
    }).sort((a, b) => a.currency.localeCompare(b.currency)) }));
    return { snapshot, qualityCards, incompleteCards, valuationChanges, financialHistory, ...reviews };
  }
  return { add, finish };
}
