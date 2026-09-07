import { accountingVersion, reportingHistory, type FinancialConfig } from "./financial-reporting.ts";
import { buildPortfolioSnapshot } from "./portfolio-analysis-snapshot.ts";
import type { PortfolioCardRecord, PortfolioScope } from "./portfolio-analysis-types.ts";
import { calculateCurrencyPosition } from "./position-accounting.ts";

export function buildReportingPortfolio(cards: PortfolioCardRecord[], scope: PortfolioScope, config: FinancialConfig, asOf = new Date()) {
  const projected = cards.map((card) => reportingHistory({ ...card, holdingQuantity: card.collectionStatus === "target" ? 0 : card.holdingQuantity }, config, asOf));
  const positions = projected.map((card) => calculateCurrencyPosition(card, config.reportingCurrency));
  const incomplete = projected.filter((card) => card.missing.length > 0);
  const incompleteCosts = projected.filter((card) => card.costMissing.length > 0);
  const unvalued = projected.filter((card, index) => positions[index].remainingQuantity > 0 && card.collectionStatus !== "target" && positions[index].currentValueMinor === null);
  const snapshot = buildPortfolioSnapshot(projected, scope, asOf);
  snapshot.accounting = {
    version: accountingVersion,
    currency: config.reportingCurrency,
    incompleteCardCount: new Set([...incomplete, ...unvalued]).size,
    missing: [...new Set([
      ...incomplete.flatMap((card) => card.missing.map((reason) => `${card.playerName} · ${card.cardTitle ?? ""} · ${reason}`)),
      ...unvalued.map((card) => `${card.playerName} · ${card.cardTitle ?? ""} · VALUATION`)
    ])],
    rates: [...new Map(projected.flatMap((card) => card.evidence).map((rate) => [rate.id, rate])).values()].map((rate) => ({ ...rate, rateMicros: String(rate.rateMicros) }))
  };
  for (const summary of snapshot.financials.currencies) {
    if (incompleteCosts.length > 0) {
      summary.purchaseAmount = summary.salesAmount = summary.expenseAmount = summary.inventoryExpenseAmount = summary.saleExpenseAmount = summary.netCashInvested = null;
      summary.activeCostBasis = summary.realizedCost = summary.realizedProfit = summary.comparableCostBasis = null;
    }
    if (incomplete.length > 0 || unvalued.length > 0) {
      summary.unrealizedDifference = summary.unrealizedReturnRate = summary.totalProfit = null;
    }
  }
  // Unknown conversions must not become numeric zero in charts or AI evidence.
  if (incompleteCosts.length > 0) {
    snapshot.timeSeries.purchases = snapshot.timeSeries.sales = snapshot.timeSeries.expenses = [];
    snapshot.activitySeries = { purchases: [], grading: [], sales: [] };
  }
  const unvaluedIds = new Set(unvalued.map(card => card.id));
  const incompleteCards = [...new Map([...incomplete, ...unvalued].map(card => [card.id, card])).values()].flatMap(card => card.id ? [{
    id: card.id, playerName: card.playerName, cardTitle: card.cardTitle ?? "",
    reasons: [...new Set([...card.missing, ...(unvaluedIds.has(card.id) ? ["VALUATION"] : [])])]
  }] : []);
  return { snapshot, cards: projected, incompleteCards };
}
