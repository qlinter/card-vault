import { createPortfolioHistoryCursor } from "./portfolio-history-cursor.ts";
import { isOwnedCollectionStatus } from "./card-stats.ts";
import { minorMoneyToNumber, normalizeCurrency, selectLatestValuation } from "./financial-history.ts";
import { roundPortfolioValue as money } from "./portfolio-number.ts";
import type { PortfolioCardRecord, PortfolioScope, PortfolioSnapshot } from "./portfolio-analysis-types.ts";
import { calculatePositions } from "./position-accounting.ts";

const DAY_MS = 86_400_000;

function recordDate(record: { occurredAt?: Date; createdAt?: Date }): Date {
  if (record.occurredAt instanceof Date && !Number.isNaN(record.occurredAt.getTime())) return record.occurredAt;
  if (record.createdAt instanceof Date && !Number.isNaN(record.createdAt.getTime())) return record.createdAt;
  return new Date(0);
}

function cardExistedAt(card: PortfolioCardRecord, at: Date): boolean {
  const hasBusinessRecord = card.transactions.some((record) => recordDate(record).getTime() <= at.getTime())
    || card.expenses.some((record) => recordDate(record).getTime() <= at.getTime())
    || card.valuations.some((record) => record.valuedAt.getTime() <= at.getTime());
  return hasBusinessRecord || !(card.createdAt instanceof Date) || card.createdAt.getTime() <= at.getTime();
}

function historicalQuantity(card: PortfolioCardRecord, _currency: string, at: Date): number {
  const transactions = card.transactions.filter((transaction) =>
    recordDate(transaction).getTime() <= at.getTime()
  );
  if (transactions.length > 0) {
    return Math.max(0, transactions.reduce((quantity, transaction) =>
      quantity + (transaction.kind === "sale" ? -1 : 1) * (transaction.quantity ?? 1), 0));
  }
  if (card.transactions.length > 0 || !isOwnedCollectionStatus(card.collectionStatus)) return 0;
  return Math.max(0, card.holdingQuantity ?? 1);
}

export type PortfolioValuationTotal = {
  currency: string;
  value: number;
  valuedCardCount: number;
};

export function portfolioValuationTotalsAt(cards: PortfolioCardRecord[], at: Date): PortfolioValuationTotal[] {
  const totals = new Map<string, PortfolioValuationTotal>();
  for (const card of cards) {
    if (!cardExistedAt(card, at)) continue;
    const valuation = selectLatestValuation(card.valuations.filter((item) => item.valuedAt.getTime() <= at.getTime()));
    if (!valuation) continue;
    const currency = normalizeCurrency(valuation.currency);
    const quantity = historicalQuantity(card, currency, at);
    if (quantity <= 0) continue;
    const current = totals.get(currency) ?? { currency, value: 0, valuedCardCount: 0 };
    current.value = money(current.value + minorMoneyToNumber(valuation.amountMinor, currency) * quantity);
    current.valuedCardCount += 1;
    totals.set(currency, current);
  }
  return [...totals.values()].sort((left, right) => left.currency.localeCompare(right.currency));
}

export type PortfolioValuationChangeCurrency = {
  currency: string;
  currentValue: number;
  baselineValue: number;
  changeAmount: number;
  changeRate: number | null;
  currentValuedCardCount: number;
  baselineValuedCardCount: number;
};

export type PortfolioValuationChange = {
  days: 30 | 90 | 180;
  baselineAt: string;
  currencies: PortfolioValuationChangeCurrency[];
};

export type PortfolioFinancialHistoryCurrency = {
  currency: string;
  portfolioValue: number | null;
  remainingCost: number | null;
  realizedProfit: number | null;
  unrealizedProfit: number | null;
};

export type PortfolioFinancialHistoryPoint = {
  month: string;
  capturedAt: string;
  currencies: PortfolioFinancialHistoryCurrency[];
  coverage: Array<{ currency: string; active: number; valued: number; costKnown: number }>;
};

function nextMonth(month: string): string {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Date(Date.UTC(year, monthNumber, 1)).toISOString().slice(0, 7);
}

function monthCutoff(month: string, asOf: Date): Date {
  if (month === asOf.toISOString().slice(0, 7)) return asOf;
  const [year, monthNumber] = month.split("-").map(Number);
  return new Date(Date.UTC(year, monthNumber, 1) - 1);
}

export function buildPortfolioFinancialHistory(
  cards: PortfolioCardRecord[],
  asOf = new Date()
): PortfolioFinancialHistoryPoint[] {
  let earliest = Infinity;
  const includeDate = (date: Date) => {
    const time = date.getTime();
    if (time <= asOf.getTime() && time < earliest) earliest = time;
  };
  for (const card of cards) {
    for (const row of card.transactions) includeDate(recordDate(row));
    for (const row of card.expenses) includeDate(recordDate(row));
    for (const row of card.valuations) includeDate(row.valuedAt);
  }
  if (earliest === Infinity) return [];

  const firstMonth = new Date(earliest).toISOString().slice(0, 7);
  const lastMonth = asOf.toISOString().slice(0, 7);
  const months: string[] = [];
  for (let month = firstMonth; month <= lastMonth; month = nextMonth(month)) months.push(month);

  const cursors = cards.map(createPortfolioHistoryCursor);
  return months.map((month) => {
    const at = monthCutoff(month, asOf);
    const totals = new Map<string, PortfolioFinancialHistoryCurrency>();
    const coverage = new Map<string, { currency: string; active: number; valued: number; costKnown: number }>();
    for (const [index, card] of cards.entries()) {
      const { positions, valuations } = cursors[index](at);
      if (!cardExistedAt(card, at)) continue;
      for (const position of positions) {
        const fallbackQuantity = card.transactions.length === 0 && isOwnedCollectionStatus(card.collectionStatus)
          ? Math.max(0, card.holdingQuantity ?? 1)
          : 0;
        const quantity = position.purchasedQuantity > 0 || position.soldQuantity > 0
          ? position.remainingQuantity
          : fallbackQuantity;
        const latestValuation = selectLatestValuation(valuations, position.currency);
        const portfolioValue = latestValuation && quantity > 0
          ? minorMoneyToNumber(latestValuation.amountMinor * BigInt(quantity), position.currency)
          : 0;
        const remainingCost = quantity > 0
          ? minorMoneyToNumber(position.remainingCostMinor, position.currency)
          : 0;
        const realizedProfit = minorMoneyToNumber(position.realizedProfitMinor, position.currency);
        const unrealizedProfit = latestValuation && quantity > 0
          ? money(portfolioValue - remainingCost)
          : 0;
        const current = totals.get(position.currency) ?? {
          currency: position.currency,
          portfolioValue: 0,
          remainingCost: 0,
          realizedProfit: 0,
          unrealizedProfit: 0
        };
        current.portfolioValue = money((current.portfolioValue ?? 0) + portfolioValue);
        current.remainingCost = current.remainingCost === null || !position.costComplete ? null : money(current.remainingCost + remainingCost);
        current.realizedProfit = current.realizedProfit === null || !position.profitComplete ? null : money(current.realizedProfit + realizedProfit);
        // Only quoted holdings contribute to this historical, potentially partial return.
        if (quantity > 0 && latestValuation) current.unrealizedProfit = current.unrealizedProfit === null || !position.profitComplete ? null : money(current.unrealizedProfit + unrealizedProfit);
        totals.set(position.currency, current);
        const counts = coverage.get(position.currency) ?? { currency: position.currency, active: 0, valued: 0, costKnown: 0 };
        if (quantity > 0) { counts.active++; if (latestValuation) counts.valued++; if (position.costComplete) counts.costKnown++; }
        coverage.set(position.currency, counts);
      }
    }
    for (const [currency, counts] of coverage) {
      if (counts.active > 0 && counts.valued === 0) {
        const total = totals.get(currency)!;
        total.portfolioValue = total.unrealizedProfit = null;
      }
    }
    return {
      month,
      capturedAt: at.toISOString(),
      coverage: [...coverage.values()],
      currencies: [...totals.values()].sort((left, right) => left.currency.localeCompare(right.currency))
    };
  });
}

export function buildPortfolioValuationChanges(
  cards: PortfolioCardRecord[],
  asOf = new Date()
): PortfolioValuationChange[] {
  const current = portfolioValuationTotalsAt(cards, asOf);
  return ([30, 90, 180] as const).map((days) => {
    const baselineAt = new Date(asOf.getTime() - days * DAY_MS);
    const baseline = portfolioValuationTotalsAt(cards, baselineAt);
    const currencies = new Set([...current, ...baseline].map((item) => item.currency));
    return {
      days,
      baselineAt: baselineAt.toISOString(),
      currencies: [...currencies].sort().map((currency) => {
        const currentItem = current.find((item) => item.currency === currency);
        const baselineItem = baseline.find((item) => item.currency === currency);
        const currentValue = currentItem?.value ?? 0;
        const baselineValue = baselineItem?.value ?? 0;
        const changeAmount = money(currentValue - baselineValue);
        return {
          currency,
          currentValue,
          baselineValue,
          changeAmount,
          changeRate: baselineValue > 0 ? money(changeAmount / baselineValue * 100) : null,
          currentValuedCardCount: currentItem?.valuedCardCount ?? 0,
          baselineValuedCardCount: baselineItem?.valuedCardCount ?? 0
        };
      })
    };
  });
}

export type PortfolioCostPosition = {
  cardId: string;
  playerName: string;
  cardTitle: string;
  currency: string;
  quantity: number;
  remainingCost: number;
  averageCost: number;
  currentValue: number | null;
};

export type PortfolioSoldReview = {
  cardId: string;
  playerName: string;
  cardTitle: string;
  currency: string;
  soldQuantity: number;
  soldAt: string | null;
  netSaleAmount: number;
  realizedCost: number;
  realizedProfit: number;
  realizedReturnRate: number | null;
  needsSaleRecord: boolean;
};

export function buildPortfolioPositionReviews(cards: PortfolioCardRecord[]): {
  highCostPositions: PortfolioCostPosition[];
  soldReviews: PortfolioSoldReview[];
} {
  const highCostPositions: PortfolioCostPosition[] = [];
  const soldReviews: PortfolioSoldReview[] = [];
  for (const card of cards) {
    const positions = calculatePositions(card);
    if (isOwnedCollectionStatus(card.collectionStatus)) {
      for (const position of positions) {
        if (!position.costComplete || position.remainingQuantity <= 0 || position.remainingCostMinor <= BigInt(0)) continue;
        highCostPositions.push({
          cardId: card.id ?? "",
          playerName: card.playerName,
          cardTitle: card.cardTitle ?? "",
          currency: position.currency,
          quantity: position.remainingQuantity,
          remainingCost: minorMoneyToNumber(position.remainingCostMinor, position.currency),
          averageCost: minorMoneyToNumber(position.averageCostMinor ?? BigInt(0), position.currency),
          currentValue: position.currentValueMinor === null
            ? null
            : minorMoneyToNumber(position.currentValueMinor, position.currency)
        });
      }
    }
    if (card.collectionStatus !== "sold") continue;
    const saleTransactions = card.transactions.filter((transaction) => transaction.kind === "sale");
    const soldPositions = positions.filter((position) => position.soldQuantity > 0);
    if (soldPositions.length === 0) {
      soldReviews.push({
        cardId: card.id ?? "",
        playerName: card.playerName,
        cardTitle: card.cardTitle ?? "",
        currency: "CNY",
        soldQuantity: 0,
        soldAt: null,
        netSaleAmount: 0,
        realizedCost: 0,
        realizedProfit: 0,
        realizedReturnRate: null,
        needsSaleRecord: true
      });
      continue;
    }
    for (const position of soldPositions) {
      if (!position.profitComplete) continue;
      const soldAt = saleTransactions
        .filter((transaction) => normalizeCurrency(transaction.currency) === position.currency)
        .map(recordDate)
        .sort((left, right) => right.getTime() - left.getTime())[0];
      const realizedCost = minorMoneyToNumber(position.realizedCostMinor, position.currency);
      const realizedProfit = minorMoneyToNumber(position.realizedProfitMinor, position.currency);
      soldReviews.push({
        cardId: card.id ?? "",
        playerName: card.playerName,
        cardTitle: card.cardTitle ?? "",
        currency: position.currency,
        soldQuantity: position.soldQuantity,
        soldAt: soldAt?.toISOString() ?? null,
        netSaleAmount: minorMoneyToNumber(position.netSaleAmountMinor, position.currency),
        realizedCost,
        realizedProfit,
        realizedReturnRate: realizedCost > 0 ? money(realizedProfit / realizedCost * 100) : null,
        needsSaleRecord: false
      });
    }
  }
  const groupedHighCost = [...new Set(highCostPositions.map((item) => item.currency))]
    .sort()
    .flatMap((currency) => highCostPositions
      .filter((item) => item.currency === currency)
      .sort((left, right) => right.remainingCost - left.remainingCost)
      .slice(0, 10));
  const groupedSoldReviews = [...new Set(soldReviews.map((item) => item.currency))]
    .sort()
    .flatMap((currency) => soldReviews
      .filter((item) => item.currency === currency)
      .sort((left, right) =>
        Number(left.needsSaleRecord) - Number(right.needsSaleRecord)
        || (right.soldAt ?? "").localeCompare(left.soldAt ?? "")
        || right.netSaleAmount - left.netSaleAmount
      )
      .slice(0, 20));
  return {
    highCostPositions: groupedHighCost,
    soldReviews: groupedSoldReviews
  };
}

export type PortfolioComparisonPoint = {
  accounting?: PortfolioSnapshot["accounting"];
  label: string;
  capturedAt: string;
  scope: PortfolioScope;
  cardCount: number;
  activeCount: number;
  soldCount: number;
  pendingGradingCount: number;
  playerCount: number;
  currencies: Array<{
    currency: string;
    latestValue: number;
    activeCostBasis: number | null;
    realizedProfit: number | null;
    totalProfit: number | null;
  }>;
  structures: Array<{
    key: string;
    label: string;
    items: Array<{
      name: string;
      countShare: number;
      valueShare: Record<string, number>;
    }>;
  }>;
};

export type PortfolioComparison = {
  left: PortfolioComparisonPoint;
  right: PortfolioComparisonPoint;
};

export function buildPortfolioComparisonPoint(
  snapshot: PortfolioSnapshot,
  label: string,
  capturedAt = new Date()
): PortfolioComparisonPoint {
  const cardTypeItems = [
    ["新秀卡", snapshot.quality.rookieCount],
    ["签名卡", snapshot.quality.autographCount],
    ["Patch", snapshot.quality.patchCount],
    ["限量卡", snapshot.quality.serialNumberedCount]
  ].map(([name, rawCount]) => ({
    name: String(name),
    countShare: snapshot.activeCount > 0 ? money(Number(rawCount) / snapshot.activeCount * 100) : 0,
    valueShare: {}
  }));
  const structureDefinitions: Array<[
    string,
    string,
    Array<{ name: string; countShare: number; valueShare: Record<string, number> }>
  ]> = [
    ["player", "卡片主体", snapshot.allocation.byPlayer],
    ["sport", "运动", snapshot.allocation.bySport],
    ["brand", "品牌", snapshot.allocation.byBrand],
    ["team", "Team", snapshot.allocation.byTeam],
    ["year", "年份", snapshot.allocation.byYear],
    ["productLine", "产品线", snapshot.allocation.byProductLine],
    ["gradingCompany", "评级机构", snapshot.allocation.byGradingCompany],
    ["cardType", "卡片属性", cardTypeItems]
  ];
  return {
    accounting: snapshot.accounting,
    label,
    capturedAt: capturedAt.toISOString(),
    scope: snapshot.scope,
    cardCount: snapshot.cardCount,
    activeCount: snapshot.activeCount,
    soldCount: snapshot.soldCount,
    pendingGradingCount: snapshot.pendingGradingCount,
    playerCount: snapshot.playerCount,
    currencies: snapshot.financials.currencies.map((summary) => ({
      currency: summary.currency,
      latestValue: summary.latestValue,
      activeCostBasis: summary.activeCostBasis,
      realizedProfit: summary.realizedProfit,
      totalProfit: summary.totalProfit
    })),
    structures: structureDefinitions.map(([key, structureLabel, items]) => ({
      key,
      label: structureLabel,
      items: items.slice(0, 20).map((item) => ({
        name: item.name,
        countShare: item.countShare,
        valueShare: item.valueShare
      }))
    }))
  };
}
