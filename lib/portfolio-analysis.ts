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

const portfolioFilterDefinitions = {
  q: "搜索关键词",
  sport: "运动类型",
  team: "球队",
  year: "年份",
  brand: "品牌",
  productLine: "产品线",
  subsetName: "子系列",
  parallel: "平行版本",
  cardNumber: "卡号",
  serialNumber: "编号",
  serialRange: "编号范围",
  isRookie: "Rookie",
  isAutograph: "签名卡",
  autoType: "签字类型",
  isPatch: "Patch/Jersey",
  patchType: "Patch 类型",
  isGraded: "已评级",
  gradingCompany: "评级机构",
  grade: "评级",
  certNumber: "证书号",
  visibility: "公开状态",
  collectionStatus: "收藏状态"
} as const;

export type PortfolioFilterField = keyof typeof portfolioFilterDefinitions;

export type PortfolioFilterCriterion = {
  field: PortfolioFilterField;
  label: string;
  value: string;
};

export type PortfolioScope = {
  isFiltered: boolean;
  criteria: PortfolioFilterCriterion[];
};

export type PortfolioSnapshot = {
  cardCount: number;
  ownedCount: number;
  playerCount: number;
  scope: PortfolioScope;
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

function displayFilterValue(field: PortfolioFilterField, value: string): string {
  if (["isRookie", "isAutograph", "isPatch", "isGraded"].includes(field)) {
    return value === "true" ? "是" : value === "false" ? "否" : value;
  }
  if (field === "visibility") {
    return { private: "私密", public: "公开", linkOnly: "仅链接可见" }[value] ?? value;
  }
  if (field === "collectionStatus") {
    return { holding: "持有中", listed: "在售", grading: "送评中", sold: "已售出", target: "目标卡" }[value] ?? value;
  }
  return value;
}

export function buildPortfolioScope(input: Record<string, string | undefined>): PortfolioScope {
  const criteria: PortfolioFilterCriterion[] = [];
  for (const field of Object.keys(portfolioFilterDefinitions) as PortfolioFilterField[]) {
    const value = input[field]?.trim();
    if (value) {
      criteria.push({ field, label: portfolioFilterDefinitions[field], value: displayFilterValue(field, value) });
    }
  }

  return { isFiltered: criteria.length > 0, criteria };
}

export function portfolioScopeInstructions(scope: PortfolioScope): string[] {
  if (!scope.isFiltered || scope.criteria.length === 0) {
    return ["本次没有应用筛选条件，可以把输入数据视为当前完整收藏范围。"];
  }

  const criteria = scope.criteria.map((item) => `${item.label}=${item.value}`).join("；");
  return [
    `本次分析对象是筛选结果，不是完整收藏。筛选条件：${criteria}。`,
    "必须把上述筛选条件视为用户主动设定的研究范围。不得因为被筛选字段在结果中高度集中，就将其判断为集中度风险、结构缺陷或扣分项。",
    "例如筛选条件为“运动类型=足球”时，不得提出“足球卡占比过高”；筛选球队、球员关键词、年份、评级或签名属性时同理。",
    "组合结构只评价筛选范围内部仍可比较的维度，并明确结论仅适用于当前筛选结果，不得外推到用户的完整收藏。",
    "summary 或 structure 中应明确说明分析基于当前筛选范围。"
  ];
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

export function buildPortfolioSnapshot(
  cards: PortfolioCardRecord[],
  scope: PortfolioScope = { isFiltered: false, criteria: [] }
): PortfolioSnapshot {
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
    scope,
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
      gradedCount: ownedCards.filter((card) => Boolean(card.gradingCompany?.trim() || card.grade?.trim())).length,
      rookieCount: ownedCards.filter((card) => card.isRookie).length,
      autographCount: ownedCards.filter((card) => card.isAutograph).length,
      patchCount: ownedCards.filter((card) => card.isPatch).length
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

function normalizePortfolioScope(value: unknown): PortfolioScope {
  const scope = objectRecord(value);
  const source = Array.isArray(scope.criteria) ? scope.criteria : [];
  const criteria: PortfolioFilterCriterion[] = [];
  for (const item of source.slice(0, Object.keys(portfolioFilterDefinitions).length)) {
    const record = objectRecord(item);
    const field = safeText(record.field, 40) as PortfolioFilterField;
    if (!(field in portfolioFilterDefinitions)) {
      continue;
    }
    const criterionValue = safeText(record.value, 120);
    if (criterionValue) {
      criteria.push({
        field,
        label: portfolioFilterDefinitions[field],
        value: displayFilterValue(field, criterionValue)
      });
    }
  }

  return { isFiltered: criteria.length > 0, criteria };
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
    scope: normalizePortfolioScope(snapshot.scope),
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
