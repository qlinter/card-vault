import { isOwnedCollectionStatus } from "./card-stats.ts";

export type PortfolioCardRecord = {
  playerName: string;
  sport: string;
  collectionStatus: string;
  currentValue: number | null;
  totalCost: number | null;
  gradingCompany: string | null;
  grade: string | null;
  isRookie: boolean;
  isAutograph: boolean;
  isPatch: boolean;
};

export type PortfolioBreakdown = {
  name: string;
  count: number;
  value: number;
};

export type PortfolioSnapshot = {
  cardCount: number;
  ownedCount: number;
  playerCount: number;
  financials: {
    totalCost: number;
    totalValue: number;
    costCoverageCount: number;
    valueCoverageCount: number;
    comparableCount: number;
    comparableCost: number;
    comparableValue: number;
    comparableDifference: number;
    comparableReturnRate: number | null;
  };
  quality: {
    gradedCount: number;
    rookieCount: number;
    autographCount: number;
    patchCount: number;
  };
  sports: PortfolioBreakdown[];
  players: PortfolioBreakdown[];
  statuses: PortfolioBreakdown[];
};

export type PortfolioAnalysis = {
  score: number;
  positioning: string;
  summary: string;
  dimensions: {
    structure: string;
    valueEfficiency: string;
    collectibleQuality: string;
    liquidityAndData: string;
  };
  strengths: string[];
  risks: string[];
  actions: string[];
};

function money(value: number): number {
  return Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;
}

function groupCards(cards: PortfolioCardRecord[], key: (card: PortfolioCardRecord) => string): PortfolioBreakdown[] {
  const groups = new Map<string, PortfolioBreakdown>();
  for (const card of cards) {
    const name = key(card).trim() || "未填写";
    const current = groups.get(name) ?? { name, count: 0, value: 0 };
    current.count += 1;
    if (isOwnedCollectionStatus(card.collectionStatus)) {
      current.value += card.currentValue ?? 0;
    }
    groups.set(name, current);
  }

  return [...groups.values()]
    .map((item) => ({ ...item, value: money(item.value) }))
    .sort((left, right) => right.value - left.value || right.count - left.count || left.name.localeCompare(right.name));
}

export function buildPortfolioSnapshot(cards: PortfolioCardRecord[]): PortfolioSnapshot {
  const ownedCards = cards.filter((card) => isOwnedCollectionStatus(card.collectionStatus));
  const comparableCards = ownedCards.filter((card) => card.totalCost !== null && card.currentValue !== null);
  const totalCost = ownedCards.reduce((sum, card) => sum + (card.totalCost ?? 0), 0);
  const totalValue = ownedCards.reduce((sum, card) => sum + (card.currentValue ?? 0), 0);
  const comparableCost = comparableCards.reduce((sum, card) => sum + (card.totalCost ?? 0), 0);
  const comparableValue = comparableCards.reduce((sum, card) => sum + (card.currentValue ?? 0), 0);
  const comparableDifference = comparableValue - comparableCost;

  return {
    cardCount: cards.length,
    ownedCount: ownedCards.length,
    playerCount: new Set(cards.map((card) => card.playerName.trim()).filter(Boolean)).size,
    financials: {
      totalCost: money(totalCost),
      totalValue: money(totalValue),
      costCoverageCount: ownedCards.filter((card) => card.totalCost !== null).length,
      valueCoverageCount: ownedCards.filter((card) => card.currentValue !== null).length,
      comparableCount: comparableCards.length,
      comparableCost: money(comparableCost),
      comparableValue: money(comparableValue),
      comparableDifference: money(comparableDifference),
      comparableReturnRate: comparableCost > 0 ? money((comparableDifference / comparableCost) * 100) : null
    },
    quality: {
      gradedCount: cards.filter((card) => Boolean(card.gradingCompany?.trim() || card.grade?.trim())).length,
      rookieCount: cards.filter((card) => card.isRookie).length,
      autographCount: cards.filter((card) => card.isAutograph).length,
      patchCount: cards.filter((card) => card.isPatch).length
    },
    sports: groupCards(cards, (card) => card.sport).slice(0, 10),
    players: groupCards(cards, (card) => card.playerName).slice(0, 12),
    statuses: groupCards(cards, (card) => card.collectionStatus).slice(0, 10)
  };
}

function safeText(value: unknown, maxLength = 1200): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function textList(value: unknown, maxItems: number): string[] {
  const items = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/\r?\n|；|;/)
      : [];

  return items
    .map((item) => safeText(item, 240).replace(/^[-*\d.、\s]+/, ""))
    .filter(Boolean)
    .slice(0, maxItems);
}

function objectRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function boundedNumber(value: unknown, minimum: number, maximum: number, fallback = 0): number {
  const number = typeof value === "number" && Number.isFinite(value) ? value : fallback;
  return Math.max(minimum, Math.min(maximum, number));
}

function boundedCount(value: unknown, maximum: number): number {
  return Math.round(boundedNumber(value, 0, maximum));
}

function normalizeBreakdowns(value: unknown, maxItems: number, maxCount: number): PortfolioBreakdown[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .slice(0, maxItems)
    .map((item) => {
      const record = objectRecord(item);
      return {
        name: safeText(record.name, 80),
        count: boundedCount(record.count, maxCount),
        value: money(boundedNumber(record.value, 0, 1_000_000_000_000))
      };
    })
    .filter((item) => item.name && item.count > 0);
}

export function normalizePortfolioSnapshot(value: unknown): PortfolioSnapshot {
  const snapshot = objectRecord(value);
  const cardCountValue = snapshot.cardCount;
  if (typeof cardCountValue !== "number" || !Number.isFinite(cardCountValue) || cardCountValue < 1 || cardCountValue > 100000) {
    throw new Error("当前组合没有可分析的卡片，或卡片数量异常。");
  }

  const cardCount = Math.round(cardCountValue);
  const ownedCount = boundedCount(snapshot.ownedCount, cardCount);
  const financials = objectRecord(snapshot.financials);
  const quality = objectRecord(snapshot.quality);

  return {
    cardCount,
    ownedCount,
    playerCount: boundedCount(snapshot.playerCount, cardCount),
    financials: {
      totalCost: money(boundedNumber(financials.totalCost, 0, 1_000_000_000_000)),
      totalValue: money(boundedNumber(financials.totalValue, 0, 1_000_000_000_000)),
      costCoverageCount: boundedCount(financials.costCoverageCount, ownedCount),
      valueCoverageCount: boundedCount(financials.valueCoverageCount, ownedCount),
      comparableCount: boundedCount(financials.comparableCount, ownedCount),
      comparableCost: money(boundedNumber(financials.comparableCost, 0, 1_000_000_000_000)),
      comparableValue: money(boundedNumber(financials.comparableValue, 0, 1_000_000_000_000)),
      comparableDifference: money(boundedNumber(financials.comparableDifference, -1_000_000_000_000, 1_000_000_000_000)),
      comparableReturnRate: financials.comparableReturnRate === null
        ? null
        : money(boundedNumber(financials.comparableReturnRate, -100000, 100000))
    },
    quality: {
      gradedCount: boundedCount(quality.gradedCount, cardCount),
      rookieCount: boundedCount(quality.rookieCount, cardCount),
      autographCount: boundedCount(quality.autographCount, cardCount),
      patchCount: boundedCount(quality.patchCount, cardCount)
    },
    sports: normalizeBreakdowns(snapshot.sports, 10, cardCount),
    players: normalizeBreakdowns(snapshot.players, 12, cardCount),
    statuses: normalizeBreakdowns(snapshot.statuses, 10, cardCount)
  };
}

export function normalizePortfolioAnalysis(value: unknown): PortfolioAnalysis {
  if (!value || typeof value !== "object") {
    throw new Error("AI 组合分析结果格式无效。");
  }

  const record = value as Record<string, unknown>;
  const nested = record.analysis && typeof record.analysis === "object"
    ? (record.analysis as Record<string, unknown>)
    : record;
  const dimensions = nested.dimensions && typeof nested.dimensions === "object"
    ? (nested.dimensions as Record<string, unknown>)
    : {};
  const scoreValue = Number(nested.score);
  if (!Number.isFinite(scoreValue)) {
    throw new Error("AI 组合分析结果缺少有效评分。");
  }
  const result: PortfolioAnalysis = {
    score: Math.max(0, Math.min(100, Math.round(scoreValue))),
    positioning: safeText(nested.positioning, 80),
    summary: safeText(nested.summary, 800),
    dimensions: {
      structure: safeText(dimensions.structure, 500),
      valueEfficiency: safeText(dimensions.valueEfficiency, 500),
      collectibleQuality: safeText(dimensions.collectibleQuality, 500),
      liquidityAndData: safeText(dimensions.liquidityAndData, 500)
    },
    strengths: textList(nested.strengths, 4),
    risks: textList(nested.risks, 4),
    actions: textList(nested.actions, 5)
  };

  if (
    !result.positioning
    || !result.summary
    || Object.values(result.dimensions).some((text) => !text)
    || !result.strengths.length
    || !result.risks.length
    || !result.actions.length
  ) {
    throw new Error("AI 组合分析结果缺少必要内容。");
  }
  return result;
}
