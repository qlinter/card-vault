import { normalizeCurrency, selectLatestValuation } from "./financial-history.ts";
import { portfolioMoneyAmount as moneyAmount, roundPortfolioValue as money } from "./portfolio-number.ts";
import type {
  PortfolioAllocation,
  PortfolioAllocationBreakdown,
  PortfolioCardRecord,
  PortfolioConcentration,
  PortfolioConcentrationDimension,
  PortfolioMoneyRecord,
  PortfolioTimeSeriesPoint,
  PortfolioTopPosition
} from "./portfolio-analysis-types.ts";
import {
  calculatePositions,
  resolvePositionQuantity,
  type CurrencyPosition
} from "./position-accounting.ts";

export type PortfolioPositionMap = ReadonlyMap<PortfolioCardRecord, CurrencyPosition[]>;

export function createPortfolioPositionMap(cards: PortfolioCardRecord[]): PortfolioPositionMap {
  return new Map(cards.map((card) => [card, calculatePositions(card)]));
}

export function portfolioCardQuantity(
  card: PortfolioCardRecord,
  currency: string,
  positions: PortfolioPositionMap
): number {
  const position = positions.get(card)?.find((item) => item.currency === normalizeCurrency(currency));
  return resolvePositionQuantity(position, card.holdingQuantity ?? 1);
}

export function allocationBreakdown(
  cards: PortfolioCardRecord[],
  key: (card: PortfolioCardRecord) => string,
  positions: PortfolioPositionMap
): PortfolioAllocationBreakdown[] {
  const groups = new Map<string, PortfolioAllocationBreakdown>();
  const totalCount = cards.length || 1;
  const totals: Record<string, number> = {};
  for (const card of cards) {
    const name = key(card).trim() || "未填写";
    const current = groups.get(name) ?? { name, count: 0, values: {}, countShare: 0, valueShare: {}, averageValue: {}, valuedCount: 0 };
    current.count += 1;
    const valuation = selectLatestValuation(card.valuations);
    if (valuation) {
      const currency = normalizeCurrency(valuation.currency);
      const quantity = portfolioCardQuantity(card, currency, positions);
      const value = money(moneyAmount(valuation) * quantity);
      current.values[currency] = (current.values[currency] ?? 0) + value;
      totals[currency] = (totals[currency] ?? 0) + value;
      current.valuedCount += 1;
    }
    groups.set(name, current);
  }
  return [...groups.values()].map((item) => {
    const valueShare: Record<string, number> = {};
    const averageValue: Record<string, number> = {};
    for (const [currency, value] of Object.entries(item.values)) {
      valueShare[currency] = totals[currency] > 0 ? money(value / totals[currency] * 100) : 0;
      averageValue[currency] = item.valuedCount > 0 ? money(value / item.valuedCount) : 0;
      item.values[currency] = money(value);
    }
    return { ...item, countShare: money(item.count / totalCount * 100), valueShare, averageValue };
  }).sort((left, right) => right.count - left.count || (right.valueShare.CNY ?? 0) - (left.valueShare.CNY ?? 0) || left.name.localeCompare(right.name));
}

export function concentrationDimension(items: PortfolioAllocationBreakdown[]): PortfolioConcentrationDimension {
  const byCurrency = (limit: number): Record<string, number> => {
    const currencies = new Set(items.flatMap((item) => Object.keys(item.valueShare)));
    return Object.fromEntries([...currencies].map((currency) => [
      currency,
      money(items
        .map((item) => item.valueShare[currency] ?? 0)
        .sort((left, right) => right - left)
        .slice(0, limit)
        .reduce((sum, share) => sum + share, 0))
    ]));
  };
  const hhiByCurrency: Record<string, number> = {};
  for (const currency of new Set(items.flatMap((item) => Object.keys(item.valueShare)))) {
    hhiByCurrency[currency] = money(items.reduce((sum, item) => sum + Math.pow((item.valueShare[currency] ?? 0) / 100, 2), 0) * 10000);
  }
  const totalCount = items.reduce((sum, item) => sum + item.count, 0);
  return {
    top1CountShare: money(items.length > 0 ? items[0].count / totalCount * 100 : 0),
    top3CountShare: money(items.length > 0 ? items.slice(0, 3).reduce((sum, item) => sum + item.count, 0) / totalCount * 100 : 0),
    top1ValueShare: byCurrency(1),
    top3ValueShare: byCurrency(3),
    hhiByCurrency
  };
}

export function emptyAllocation(): PortfolioAllocation {
  return Object.fromEntries([
    "bySport", "byPlayer", "byTeam", "byYear", "byBrand", "byProductLine", "bySubsetName", "byParallel", "byStatus", "byGradingCompany", "byGrade", "byAutoType", "byPatchType", "byTag"
  ].map((key) => [key, []])) as unknown as PortfolioAllocation;
}

export function normalizeConcentration(value: unknown, currencies: readonly string[]): PortfolioConcentration {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const normalize = (item: unknown): PortfolioConcentrationDimension => {
    const record = item && typeof item === "object" && !Array.isArray(item) ? item as Record<string, unknown> : {};
    const currencyValues = (input: unknown) => {
      const sourceValues = input && typeof input === "object" && !Array.isArray(input) ? input as Record<string, unknown> : {};
      return Object.fromEntries(Object.entries(sourceValues).filter(([key]) => currencies.includes(key)).map(([key, entry]) => [key, money(Math.max(0, Math.min(10000, typeof entry === "number" && Number.isFinite(entry) ? entry : 0)))]));
    };
    return { top1CountShare: money(Math.max(0, Math.min(100, Number(record.top1CountShare) || 0))), top3CountShare: money(Math.max(0, Math.min(100, Number(record.top3CountShare) || 0))), top1ValueShare: currencyValues(record.top1ValueShare), top3ValueShare: currencyValues(record.top3ValueShare), hhiByCurrency: currencyValues(record.hhiByCurrency) };
  };
  return { player: normalize(source.player), sport: normalize(source.sport), team: normalize(source.team), brand: normalize(source.brand), productLine: normalize(source.productLine) };
}

export function monthlySeries(cards: PortfolioCardRecord[], kind: "purchase" | "sale" | "expense" | "valuation"): PortfolioTimeSeriesPoint[] {
  const groups = new Map<string, PortfolioTimeSeriesPoint>();
  for (const card of cards) {
    const records = kind === "valuation" ? card.valuations : kind === "expense" ? card.expenses : card.transactions.filter((item) => item.kind === kind);
    for (const record of records) {
      if ("available" in record && record.available === false) continue;
      const date: Date | undefined = "valuedAt" in record
        ? (record.valuedAt instanceof Date ? record.valuedAt : undefined)
        : (record.occurredAt instanceof Date ? record.occurredAt : undefined);
      if (!date) continue;
      const month = date.toISOString().slice(0, 7);
      const point = groups.get(month) ?? { month, count: 0, values: {} };
      point.count += 1;
      const currency = normalizeCurrency(record.currency);
      point.values[currency] = money((point.values[currency] ?? 0) + moneyAmount(record as PortfolioMoneyRecord));
      groups.set(month, point);
    }
  }
  return [...groups.values()].sort((left, right) => left.month.localeCompare(right.month));
}

export function monthlyActivitySeries(cards: PortfolioCardRecord[]): {
  purchases: PortfolioTimeSeriesPoint[];
  grading: PortfolioTimeSeriesPoint[];
  sales: PortfolioTimeSeriesPoint[];
} {
  const groups = {
    purchases: new Map<string, PortfolioTimeSeriesPoint>(),
    grading: new Map<string, PortfolioTimeSeriesPoint>(),
    sales: new Map<string, PortfolioTimeSeriesPoint>()
  };

  const add = (
    kind: keyof typeof groups,
    record: PortfolioMoneyRecord,
    sign = 1,
    quantity = 0
  ) => {
    const date = record.occurredAt instanceof Date ? record.occurredAt : record.createdAt;
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return;
    const month = date.toISOString().slice(0, 7);
    const point = groups[kind].get(month) ?? { month, count: 0, values: {} };
    const currency = normalizeCurrency(record.currency);
    point.count += quantity;
    point.values[currency] = money((point.values[currency] ?? 0) + moneyAmount(record) * sign);
    groups[kind].set(month, point);
  };

  for (const card of cards) {
    for (const transaction of card.transactions) {
      if (transaction.kind === "purchase") add("purchases", transaction, 1, transaction.quantity ?? 1);
      if (transaction.kind === "sale") add("sales", transaction, 1, transaction.quantity ?? 1);
    }
    for (const expense of card.expenses) {
      if (expense.context === "purchase") add("purchases", expense);
      else if (expense.context === "sale") add("sales", expense, -1);
      else add("grading", expense, 1, 1);
    }
  }

  const sorted = (group: Map<string, PortfolioTimeSeriesPoint>) => [...group.values()]
    .sort((left, right) => left.month.localeCompare(right.month));
  return {
    purchases: sorted(groups.purchases),
    grading: sorted(groups.grading),
    sales: sorted(groups.sales)
  };
}

export function topPositions(
  cards: PortfolioCardRecord[],
  asOf: Date,
  positions: PortfolioPositionMap
): PortfolioTopPosition[] {
  return cards.filter((card) => selectLatestValuation(card.valuations) !== null).map((card) => {
    const valuation = selectLatestValuation(card.valuations);
    const fields = [card.playerName, card.cardTitle, card.sport, card.team, card.year, card.brand, card.productLine, card.subsetName, card.parallel, card.cardNumber];
    const fieldCompleteness = money(fields.filter((field) => Boolean(String(field ?? "").trim())).length / fields.length * 100);
    const quantity = valuation
      ? portfolioCardQuantity(card, valuation.currency, positions)
      : card.holdingQuantity ?? 1;
    return {
      playerName: card.playerName,
      cardTitle: card.cardTitle ?? "",
      sport: card.sport,
      team: card.team ?? null,
      year: card.year ?? null,
      brand: card.brand ?? null,
      productLine: card.productLine ?? null,
      subsetName: card.subsetName ?? null,
      parallel: card.parallel ?? null,
      collectionStatus: card.collectionStatus,
      gradingCompany: card.gradingCompany,
      grade: card.grade,
      isRookie: card.isRookie,
      isAutograph: card.isAutograph,
      isPatch: card.isPatch,
      isSerialNumbered: Boolean(card.isSerialNumbered),
      currency: valuation ? normalizeCurrency(valuation.currency) : "CNY",
      latestValue: valuation ? money(moneyAmount(valuation) * quantity) : 0,
      valuedAt: valuation?.valuedAt.toISOString() ?? "",
      valuationAgeDays: valuation ? Math.max(0, Math.floor((asOf.getTime() - valuation.valuedAt.getTime()) / 86_400_000)) : 99999,
      fieldCompleteness
    };
  }).sort((left, right) => right.latestValue - left.latestValue).slice(0, 10);
}
