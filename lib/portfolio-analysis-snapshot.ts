import { compareCollectionStatuses } from "./card-domain.ts";
import { minorMoneyToNumber, normalizeCurrency } from "./financial-history.ts";
import { portfolioMoneyAmount as moneyAmount, roundPortfolioValue as money } from "./portfolio-number.ts";
import { assessPortfolioCardQuality, portfolioQualityMetrics } from "./portfolio-quality.ts";
import {
  allocationBreakdown,
  concentrationDimension,
  createPortfolioCardFacts,
  monthlyActivitySeries,
  monthlySeries,
  topPositions,
  type PortfolioCardFacts
} from "./portfolio-analysis-statistics.ts";
import type { PortfolioAttentionItem, PortfolioCardRecord, PortfolioCurrencySummary, PortfolioScope, PortfolioSnapshot } from "./portfolio-analysis-types.ts";

type CompleteSummary = { [K in keyof PortfolioCurrencySummary]: K extends "unrealizedReturnRate" ? PortfolioCurrencySummary[K] : NonNullable<PortfolioCurrencySummary[K]> };

const portfolioCurrencies = ["CNY", "USD"] as const;

function blankCurrencySummary(currency: string): CompleteSummary {
  return { currency, purchaseAmount: 0, salesAmount: 0, expenseAmount: 0, inventoryExpenseAmount: 0, saleExpenseAmount: 0, netCashInvested: 0, latestValue: 0, valuedCardCount: 0, activeCostBasis: 0, activeLatestValue: 0, activeValuedCardCount: 0, comparableCardCount: 0, comparableCostBasis: 0, comparableValue: 0, realizedCost: 0, realizedProfit: 0, unrealizedDifference: 0, unrealizedReturnRate: null, totalProfit: 0 };
}

function currencySummary(map: Map<string, CompleteSummary>, currencyValue: string): CompleteSummary {
  const currency = normalizeCurrency(currencyValue);
  const current = map.get(currency) ?? blankCurrencySummary(currency);
  map.set(currency, current);
  return current;
}

function groupCards(
  cards: PortfolioCardRecord[],
  key: (card: PortfolioCardRecord) => string,
  facts: PortfolioCardFacts
) {
  const groups = new Map<string, { name: string; count: number; values: Record<string, number> }>();
  for (const card of cards) {
    const name = key(card).trim() || "未填写";
    const current = groups.get(name) ?? { name, count: 0, values: {} };
    current.count += 1;
    const { valuation, value } = facts.get(card)!;
    if (valuation) {
      const currency = normalizeCurrency(valuation.currency);
      current.values[currency] = money((current.values[currency] ?? 0) + value);
    }
    groups.set(name, current);
  }
  return [...groups.values()].sort((left, right) => right.count - left.count || (right.values.CNY ?? 0) - (left.values.CNY ?? 0) || (right.values.USD ?? 0) - (left.values.USD ?? 0) || left.name.localeCompare(right.name));
}

export function buildPortfolioSnapshot(cards: PortfolioCardRecord[], scope: PortfolioScope = { isFiltered: false, criteria: [] }, asOf = new Date()): PortfolioSnapshot {
  const cardFacts = createPortfolioCardFacts(cards);
  const activeCards = cards.filter((card) => cardFacts.get(card)!.quantity > 0);
  const summaries = new Map<string, CompleteSummary>();
  const sourceCounts = new Map<string, number>();
  const latestDates: Date[] = [];
  let valuationCoverageCount = 0;
  let freshValuationCount = 0;
  let staleValuationCount = 0;

  for (const card of cards) {
    const { positions, valuation, quantity, value } = cardFacts.get(card)!;
    // A quoted closed archive still identifies its reporting currency.
    if (valuation && quantity === 0) currencySummary(summaries, valuation.currency);
    if (valuation && quantity > 0) {
      const summary = currencySummary(summaries, valuation.currency);
      const currency = normalizeCurrency(valuation.currency);
      summary.latestValue += value;
      summary.activeLatestValue += value;
      summary.activeValuedCardCount += 1;
      const position = positions.find(item => item.currency === currency);
      if (position?.costComplete) {
        summary.comparableCardCount += 1;
        summary.comparableCostBasis += minorMoneyToNumber(position.remainingCostMinor, currency);
        summary.comparableValue += value;
      }
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
      if (transaction.kind === "sale") summary.salesAmount += amount;
    }
    for (const expense of card.expenses) {
      const summary = currencySummary(summaries, expense.currency);
      const amount = moneyAmount(expense);
      summary.expenseAmount += amount;
      if (expense.context === "sale") summary.saleExpenseAmount += amount;
      else summary.inventoryExpenseAmount += amount;
    }
    for (const position of positions) {
      const summary = currencySummary(summaries, position.currency);
      summary.realizedCost += minorMoneyToNumber(position.realizedCostMinor, position.currency);
      summary.realizedProfit += minorMoneyToNumber(position.realizedProfitMinor, position.currency);
      if (quantity > 0 && position.remainingQuantity > 0) {
        summary.activeCostBasis += minorMoneyToNumber(position.remainingCostMinor, position.currency);
      }
    }
  }

  const currencies = [...summaries.values()].map((summary) => {
    summary.purchaseAmount = money(summary.purchaseAmount); summary.salesAmount = money(summary.salesAmount); summary.expenseAmount = money(summary.expenseAmount); summary.inventoryExpenseAmount = money(summary.inventoryExpenseAmount); summary.saleExpenseAmount = money(summary.saleExpenseAmount);
    summary.netCashInvested = money(summary.purchaseAmount + summary.expenseAmount - summary.salesAmount); summary.latestValue = money(summary.latestValue); summary.activeCostBasis = money(summary.activeCostBasis); summary.activeLatestValue = money(summary.activeLatestValue); summary.comparableCostBasis = money(summary.comparableCostBasis); summary.comparableValue = money(summary.comparableValue); summary.realizedCost = money(summary.realizedCost); summary.realizedProfit = money(summary.realizedProfit); summary.unrealizedDifference = money(summary.comparableValue - summary.comparableCostBasis); summary.unrealizedReturnRate = summary.comparableCostBasis > 0 ? money(summary.unrealizedDifference / summary.comparableCostBasis * 100) : null; summary.totalProfit = money(summary.realizedProfit + summary.unrealizedDifference);
    return summary;
  }).sort((left, right) => portfolioCurrencies.indexOf(left.currency as (typeof portfolioCurrencies)[number]) - portfolioCurrencies.indexOf(right.currency as (typeof portfolioCurrencies)[number]));
  const sortedDates = latestDates.sort((left, right) => left.getTime() - right.getTime());
  const allocation = {
    bySport: allocationBreakdown(cards, (card) => card.sport, cardFacts),
    byPlayer: allocationBreakdown(cards, (card) => card.playerName, cardFacts),
    byTeam: allocationBreakdown(cards, (card) => card.team ?? "", cardFacts),
    byYear: allocationBreakdown(cards, (card) => card.year ?? "", cardFacts),
    byBrand: allocationBreakdown(cards, (card) => card.brand ?? "", cardFacts),
    byProductLine: allocationBreakdown(cards, (card) => card.productLine ?? "", cardFacts),
    bySubsetName: allocationBreakdown(cards, (card) => card.subsetName ?? "", cardFacts),
    byParallel: allocationBreakdown(cards, (card) => card.parallel ?? "", cardFacts),
    byStatus: allocationBreakdown(cards, (card) => card.collectionStatus, cardFacts).sort((a, b) => compareCollectionStatuses(a.name, b.name)),
    byGradingCompany: allocationBreakdown(cards, (card) => card.gradingCompany ?? "", cardFacts),
    byGrade: allocationBreakdown(cards, (card) => card.grade ?? "", cardFacts),
    byAutoType: allocationBreakdown(cards, (card) => card.autoType ?? "", cardFacts),
    byPatchType: allocationBreakdown(cards, (card) => card.patchType ?? "", cardFacts),
    byTag: allocationBreakdown(cards, (card) => (card.tags ?? "").split(",")[0] ?? "", cardFacts)
  };
  const concentration = { player: concentrationDimension(allocation.byPlayer), sport: concentrationDimension(allocation.bySport), team: concentrationDimension(allocation.byTeam), brand: concentrationDimension(allocation.byBrand), productLine: concentrationDimension(allocation.byProductLine) };
  const imageCount = cards.reduce((sum, card) => sum + (card.imageCount ?? 0), 0);
  const imageCoverageCount = cards.filter((card) => (card.imageCount ?? 0) > 0).length;
  const publicDescriptionCoverageCount = cards.filter((card) => Boolean(card.publicDescription?.trim())).length;
  const qualityAssessments = cards.map((card) => assessPortfolioCardQuality({
    playerName: card.playerName,
    cardTitle: card.cardTitle ?? "",
    sport: card.sport,
    imageCount: card.imageCount ?? 0,
    transactionCount: card.transactions.length,
    valuations: card.valuations
  }, asOf));
  const incompleteCardCount = qualityAssessments.filter((item) => item.issueTypes.includes("incomplete_data")).length;
  const attentionItems = portfolioQualityMetrics.map((metric) => ({
    type: metric.type,
    priority: metric.priority,
    count: qualityAssessments.filter((item) => item.issueTypes.includes(metric.type)).length
  })).filter((item) => item.count > 0) as PortfolioAttentionItem[];
  const activitySeries = monthlyActivitySeries(cards);
  return {
    cardCount: cards.length, activeCount: activeCards.length, soldCount: cards.filter((card) => card.collectionStatus === "sold").length, pendingGradingCount: cards.filter((card) => card.collectionStatus === "pending_grading").length, playerCount: new Set(cards.map((card) => card.playerName.trim()).filter(Boolean)).size, scope,
    financials: { currencies, transactionCoverageCount: cards.filter((card) => card.transactions.length > 0).length, expenseCoverageCount: cards.filter((card) => card.expenses.length > 0).length, valuationCoverageCount, valuationEligibleCount: activeCards.length, freshValuationCount, staleValuationCount, latestValuationAt: sortedDates.at(-1)?.toISOString() ?? null, oldestLatestValuationAt: sortedDates[0]?.toISOString() ?? null, valuationSources: [...sourceCounts.entries()].map(([name, count]) => ({ name, count })).sort((left, right) => right.count - left.count || left.name.localeCompare(right.name)) },
    quality: { gradedCount: activeCards.filter((card) => Boolean(card.gradingCompany?.trim() || card.grade?.trim())).length, rookieCount: activeCards.filter((card) => card.isRookie).length, autographCount: activeCards.filter((card) => card.isAutograph).length, patchCount: activeCards.filter((card) => card.isPatch).length, serialNumberedCount: activeCards.filter((card) => card.isSerialNumbered).length, gradingCompanies: allocation.byGradingCompany, grades: allocation.byGrade, autoTypes: allocationBreakdown(activeCards.filter((card) => card.isAutograph), (card) => card.autoType ?? "", cardFacts), patchTypes: allocationBreakdown(activeCards.filter((card) => card.isPatch), (card) => card.patchType ?? "", cardFacts) },
    sports: groupCards(cards, (card) => card.sport, cardFacts).slice(0, 10), players: groupCards(cards, (card) => card.playerName, cardFacts).slice(0, 12), statuses: groupCards(cards, (card) => card.collectionStatus, cardFacts).sort((a, b) => compareCollectionStatuses(a.name, b.name)), allocation, concentration,
    coverage: { imageCount, imageCoverageCount, publicDescriptionCoverageCount, coreFieldCompletenessAverage: cards.length > 0 ? money(cards.reduce((sum, card) => sum + (card.playerName && card.sport && card.cardTitle ? 100 : 66.67), 0) / cards.length) : 0, incompleteCardCount },
    timeSeries: { purchases: monthlySeries(cards, "purchase"), sales: monthlySeries(cards, "sale"), expenses: monthlySeries(cards, "expense"), valuations: monthlySeries(cards, "valuation") }, activitySeries, attentionItems, topPositions: topPositions(activeCards, asOf, cardFacts)
  };
}
