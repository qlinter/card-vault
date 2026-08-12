import { minorMoneyToNumber, normalizeCurrency, selectLatestValuation } from "./financial-history.ts";
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

function money(value: number): number {
  return Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;
}

function moneyAmount(record: PortfolioMoneyRecord): number {
  return minorMoneyToNumber(record.amountMinor, normalizeCurrency(record.currency));
}

export function allocationBreakdown(cards: PortfolioCardRecord[], key: (card: PortfolioCardRecord) => string): PortfolioAllocationBreakdown[] {
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
      const value = moneyAmount(valuation);
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
    return Object.fromEntries([...currencies].map((currency) => [currency, money(items.slice(0, limit).reduce((sum, item) => sum + (item.valueShare[currency] ?? 0), 0))]));
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

export function topPositions(cards: PortfolioCardRecord[], asOf: Date): PortfolioTopPosition[] {
  return cards.map((card) => {
    const valuation = selectLatestValuation(card.valuations);
    const fields = [card.playerName, card.cardTitle, card.sport, card.team, card.year, card.brand, card.productLine, card.subsetName, card.parallel, card.cardNumber];
    const fieldCompleteness = money(fields.filter((field) => Boolean(String(field ?? "").trim())).length / fields.length * 100);
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
      latestValue: valuation ? moneyAmount(valuation) : 0,
      valuedAt: valuation?.valuedAt.toISOString() ?? "",
      valuationAgeDays: valuation ? Math.max(0, Math.floor((asOf.getTime() - valuation.valuedAt.getTime()) / 86_400_000)) : 99999,
      fieldCompleteness
    };
  }).sort((left, right) => right.latestValue - left.latestValue).slice(0, 10);
}
