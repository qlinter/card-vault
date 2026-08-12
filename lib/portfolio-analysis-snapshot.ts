import { isOwnedCollectionStatus } from "./card-stats.ts";
import { minorMoneyToNumber, normalizeCurrency, selectLatestValuation } from "./financial-history.ts";
import { allocationBreakdown, concentrationDimension, monthlySeries, topPositions } from "./portfolio-analysis-statistics.ts";
import type { PortfolioAttentionItem, PortfolioCardRecord, PortfolioCurrencySummary, PortfolioScope, PortfolioSnapshot } from "./portfolio-analysis-types.ts";

const portfolioCurrencies = ["CNY", "USD"] as const;

function money(value: number): number { return Math.round((Number.isFinite(value) ? value : 0) * 100) / 100; }
function moneyAmount(record: { amountMinor: bigint; currency: string }): number { return minorMoneyToNumber(record.amountMinor, normalizeCurrency(record.currency)); }

function blankCurrencySummary(currency: string): PortfolioCurrencySummary {
  return { currency, purchaseAmount: 0, refundAmount: 0, salesAmount: 0, expenseAmount: 0, netCashInvested: 0, latestValue: 0, valuedCardCount: 0, activeCostBasis: 0, activeLatestValue: 0, activeValuedCardCount: 0, comparableCardCount: 0, comparableCostBasis: 0, comparableValue: 0, unrealizedDifference: 0, unrealizedReturnRate: null };
}

function currencySummary(map: Map<string, PortfolioCurrencySummary>, currencyValue: string): PortfolioCurrencySummary {
  const currency = normalizeCurrency(currencyValue);
  const current = map.get(currency) ?? blankCurrencySummary(currency);
  map.set(currency, current);
  return current;
}

function groupCards(cards: PortfolioCardRecord[], key: (card: PortfolioCardRecord) => string) {
  const groups = new Map<string, { name: string; count: number; values: Record<string, number> }>();
  for (const card of cards) {
    const name = key(card).trim() || "未填写";
    const current = groups.get(name) ?? { name, count: 0, values: {} };
    current.count += 1;
    const valuation = selectLatestValuation(card.valuations);
    if (valuation) {
      const currency = normalizeCurrency(valuation.currency);
      current.values[currency] = money((current.values[currency] ?? 0) + moneyAmount(valuation));
    }
    groups.set(name, current);
  }
  return [...groups.values()].sort((left, right) => right.count - left.count || (right.values.CNY ?? 0) - (left.values.CNY ?? 0) || (right.values.USD ?? 0) - (left.values.USD ?? 0) || left.name.localeCompare(right.name));
}

export function buildPortfolioSnapshot(cards: PortfolioCardRecord[], scope: PortfolioScope = { isFiltered: false, criteria: [] }, asOf = new Date()): PortfolioSnapshot {
  const activeCards = cards.filter((card) => isOwnedCollectionStatus(card.collectionStatus));
  const summaries = new Map<string, PortfolioCurrencySummary>();
  const sourceCounts = new Map<string, number>();
  const latestDates: Date[] = [];
  let valuationCoverageCount = 0;
  let freshValuationCount = 0;
  let staleValuationCount = 0;
  let excludedComplexPositionCount = 0;

  for (const card of cards) {
    const valuation = selectLatestValuation(card.valuations);
    if (valuation) {
      const summary = currencySummary(summaries, valuation.currency);
      summary.latestValue += moneyAmount(valuation);
      summary.valuedCardCount += 1;
      valuationCoverageCount += 1;
      latestDates.push(valuation.valuedAt);
      const ageDays = Math.max(0, (asOf.getTime() - valuation.valuedAt.getTime()) / 86_400_000);
      if (ageDays <= 90) freshValuationCount += 1;
      if (ageDays > 180) staleValuationCount += 1;
      const source = valuation.source.trim() || "未填写";
      sourceCounts.set(source, (sourceCounts.get(source) ?? 0) + 1);
    }
    for (const transaction of card.transactions) {
      const summary = currencySummary(summaries, transaction.currency);
      const amount = moneyAmount(transaction);
      if (transaction.kind === "purchase") summary.purchaseAmount += amount;
      if (transaction.kind === "refund") summary.refundAmount += amount;
      if (transaction.kind === "sale") summary.salesAmount += amount;
    }
    for (const expense of card.expenses) currencySummary(summaries, expense.currency).expenseAmount += moneyAmount(expense);
    if (!isOwnedCollectionStatus(card.collectionStatus)) continue;

    const currencies = new Set([...card.transactions.map((item) => normalizeCurrency(item.currency)), ...card.expenses.map((item) => normalizeCurrency(item.currency))]);
    for (const currency of currencies) {
      const transactions = card.transactions.filter((item) => normalizeCurrency(item.currency) === currency);
      const purchases = transactions.filter((item) => item.kind === "purchase").reduce((sum, item) => sum + moneyAmount(item), 0);
      const refunds = transactions.filter((item) => item.kind === "refund").reduce((sum, item) => sum + moneyAmount(item), 0);
      const expenses = card.expenses.filter((item) => normalizeCurrency(item.currency) === currency).reduce((sum, item) => sum + moneyAmount(item), 0);
      currencySummary(summaries, currency).activeCostBasis += Math.max(0, purchases - refunds) + expenses;
    }
    if (valuation) {
      const currency = normalizeCurrency(valuation.currency);
      const summary = currencySummary(summaries, currency);
      const value = moneyAmount(valuation);
      summary.activeLatestValue += value;
      summary.activeValuedCardCount += 1;
      const sameCurrencyTransactions = card.transactions.filter((item) => normalizeCurrency(item.currency) === currency);
      const purchases = sameCurrencyTransactions.filter((item) => item.kind === "purchase").reduce((sum, item) => sum + moneyAmount(item), 0);
      const refunds = sameCurrencyTransactions.filter((item) => item.kind === "refund").reduce((sum, item) => sum + moneyAmount(item), 0);
      const expenses = card.expenses.filter((item) => normalizeCurrency(item.currency) === currency).reduce((sum, item) => sum + moneyAmount(item), 0);
      const hasSale = card.transactions.some((item) => item.kind === "sale");
      if (purchases > 0 && !hasSale) { summary.comparableCardCount += 1; summary.comparableCostBasis += Math.max(0, purchases - refunds) + expenses; summary.comparableValue += value; }
      else if (hasSale) excludedComplexPositionCount += 1;
    }
  }

  const currencies = [...summaries.values()].map((summary) => {
    summary.purchaseAmount = money(summary.purchaseAmount); summary.refundAmount = money(summary.refundAmount); summary.salesAmount = money(summary.salesAmount); summary.expenseAmount = money(summary.expenseAmount);
    summary.netCashInvested = money(summary.purchaseAmount + summary.expenseAmount - summary.refundAmount - summary.salesAmount); summary.latestValue = money(summary.latestValue); summary.activeCostBasis = money(summary.activeCostBasis); summary.activeLatestValue = money(summary.activeLatestValue); summary.comparableCostBasis = money(summary.comparableCostBasis); summary.comparableValue = money(summary.comparableValue); summary.unrealizedDifference = money(summary.comparableValue - summary.comparableCostBasis); summary.unrealizedReturnRate = summary.comparableCostBasis > 0 ? money(summary.unrealizedDifference / summary.comparableCostBasis * 100) : null;
    return summary;
  }).sort((left, right) => portfolioCurrencies.indexOf(left.currency as (typeof portfolioCurrencies)[number]) - portfolioCurrencies.indexOf(right.currency as (typeof portfolioCurrencies)[number]));
  const sortedDates = latestDates.sort((left, right) => left.getTime() - right.getTime());
  const allocation = {
    bySport: allocationBreakdown(cards, (card) => card.sport), byPlayer: allocationBreakdown(cards, (card) => card.playerName), byTeam: allocationBreakdown(cards, (card) => card.team ?? ""), byYear: allocationBreakdown(cards, (card) => card.year ?? ""), byBrand: allocationBreakdown(cards, (card) => card.brand ?? ""), byProductLine: allocationBreakdown(cards, (card) => card.productLine ?? ""), bySubsetName: allocationBreakdown(cards, (card) => card.subsetName ?? ""), byParallel: allocationBreakdown(cards, (card) => card.parallel ?? ""), byStatus: allocationBreakdown(cards, (card) => card.collectionStatus), byGradingCompany: allocationBreakdown(cards, (card) => card.gradingCompany ?? ""), byGrade: allocationBreakdown(cards, (card) => card.grade ?? ""), byAutoType: allocationBreakdown(cards, (card) => card.autoType ?? ""), byPatchType: allocationBreakdown(cards, (card) => card.patchType ?? ""), byTag: allocationBreakdown(cards, (card) => (card.tags ?? "").split(",")[0] ?? "")
  };
  const concentration = { player: concentrationDimension(allocation.byPlayer), sport: concentrationDimension(allocation.bySport), team: concentrationDimension(allocation.byTeam), brand: concentrationDimension(allocation.byBrand), productLine: concentrationDimension(allocation.byProductLine) };
  const imageCount = cards.reduce((sum, card) => sum + (card.imageCount ?? 0), 0);
  const imageCoverageCount = cards.filter((card) => (card.imageCount ?? 0) > 0).length;
  const publicDescriptionCoverageCount = cards.filter((card) => Boolean(card.publicDescription?.trim())).length;
  const incompleteCardCount = cards.filter((card) => !card.playerName.trim() || !card.sport.trim() || !card.cardTitle?.trim() || !selectLatestValuation(card.valuations)).length;
  const attentionItems = [{ type: "missing_valuation", priority: cards.length - valuationCoverageCount > 0 ? "high" : "low", count: cards.length - valuationCoverageCount }, { type: "stale_valuation", priority: staleValuationCount > 0 ? "medium" : "low", count: staleValuationCount }, { type: "missing_transaction", priority: cards.some((card) => card.transactions.length === 0) ? "medium" : "low", count: cards.filter((card) => card.transactions.length === 0).length }, { type: "missing_image", priority: "low", count: cards.length - imageCoverageCount }, { type: "incomplete_data", priority: incompleteCardCount > 0 ? "medium" : "low", count: incompleteCardCount }].filter((item) => item.count > 0) as PortfolioAttentionItem[];
  return {
    cardCount: cards.length, activeCount: activeCards.length, soldCount: cards.filter((card) => card.collectionStatus === "sold").length, targetCount: cards.filter((card) => card.collectionStatus === "target").length, playerCount: new Set(cards.map((card) => card.playerName.trim()).filter(Boolean)).size, scope,
    financials: { currencies, transactionCoverageCount: cards.filter((card) => card.transactions.length > 0).length, expenseCoverageCount: cards.filter((card) => card.expenses.length > 0).length, valuationCoverageCount, freshValuationCount, staleValuationCount, latestValuationAt: sortedDates.at(-1)?.toISOString() ?? null, oldestLatestValuationAt: sortedDates[0]?.toISOString() ?? null, valuationSources: [...sourceCounts.entries()].map(([name, count]) => ({ name, count })).sort((left, right) => right.count - left.count || left.name.localeCompare(right.name)), excludedComplexPositionCount },
    quality: { gradedCount: activeCards.filter((card) => Boolean(card.gradingCompany?.trim() || card.grade?.trim())).length, rookieCount: activeCards.filter((card) => card.isRookie).length, autographCount: activeCards.filter((card) => card.isAutograph).length, patchCount: activeCards.filter((card) => card.isPatch).length, serialNumberedCount: activeCards.filter((card) => card.isSerialNumbered).length, gradingCompanies: allocation.byGradingCompany, grades: allocation.byGrade, autoTypes: allocationBreakdown(activeCards.filter((card) => card.isAutograph), (card) => card.autoType ?? ""), patchTypes: allocationBreakdown(activeCards.filter((card) => card.isPatch), (card) => card.patchType ?? "") },
    sports: groupCards(cards, (card) => card.sport).slice(0, 10), players: groupCards(cards, (card) => card.playerName).slice(0, 12), statuses: groupCards(cards, (card) => card.collectionStatus).slice(0, 10), allocation, concentration,
    coverage: { imageCount, imageCoverageCount, publicDescriptionCoverageCount, coreFieldCompletenessAverage: cards.length > 0 ? money(cards.reduce((sum, card) => sum + (card.playerName && card.sport && card.cardTitle ? 100 : 66.67), 0) / cards.length) : 0, incompleteCardCount },
    timeSeries: { purchases: monthlySeries(cards, "purchase"), sales: monthlySeries(cards, "sale"), expenses: monthlySeries(cards, "expense"), valuations: monthlySeries(cards, "valuation") }, attentionItems, topPositions: topPositions(cards, asOf)
  };
}
