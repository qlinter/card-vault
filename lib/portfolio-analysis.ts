import { isOwnedCollectionStatus } from "./card-stats.ts";
import { minorMoneyToNumber, normalizeCurrency, selectLatestValuation } from "./financial-history.ts";

const portfolioCurrencies = ["CNY", "USD"] as const;

type PortfolioMoneyRecord = {
  amountMinor: bigint;
  currency: string;
};

type PortfolioTransactionRecord = PortfolioMoneyRecord & {
  kind: string;
};

type PortfolioValuationRecord = PortfolioMoneyRecord & {
  valuedAt: Date;
  createdAt: Date;
  source: string;
};

export type PortfolioCardRecord = {
  playerName: string;
  sport: string;
  collectionStatus: string;
  gradingCompany: string | null;
  grade: string | null;
  isRookie: boolean;
  isAutograph: boolean;
  isPatch: boolean;
  transactions: PortfolioTransactionRecord[];
  expenses: PortfolioMoneyRecord[];
  valuations: PortfolioValuationRecord[];
};

export type PortfolioBreakdown = {
  name: string;
  count: number;
  values: Record<string, number>;
};

export type PortfolioCurrencySummary = {
  currency: string;
  purchaseAmount: number;
  refundAmount: number;
  salesAmount: number;
  expenseAmount: number;
  netCashInvested: number;
  latestValue: number;
  valuedCardCount: number;
  activeCostBasis: number;
  activeLatestValue: number;
  activeValuedCardCount: number;
  comparableCardCount: number;
  comparableCostBasis: number;
  comparableValue: number;
  unrealizedDifference: number;
  unrealizedReturnRate: number | null;
};

export type PortfolioSourceBreakdown = {
  name: string;
  count: number;
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
  activeCount: number;
  soldCount: number;
  targetCount: number;
  playerCount: number;
  scope: PortfolioScope;
  financials: {
    currencies: PortfolioCurrencySummary[];
    transactionCoverageCount: number;
    expenseCoverageCount: number;
    valuationCoverageCount: number;
    freshValuationCount: number;
    staleValuationCount: number;
    latestValuationAt: string | null;
    oldestLatestValuationAt: string | null;
    valuationSources: PortfolioSourceBreakdown[];
    excludedComplexPositionCount: number;
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

function moneyAmount(record: PortfolioMoneyRecord): number {
  return minorMoneyToNumber(record.amountMinor, normalizeCurrency(record.currency));
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

function blankCurrencySummary(currency: string): PortfolioCurrencySummary {
  return {
    currency,
    purchaseAmount: 0,
    refundAmount: 0,
    salesAmount: 0,
    expenseAmount: 0,
    netCashInvested: 0,
    latestValue: 0,
    valuedCardCount: 0,
    activeCostBasis: 0,
    activeLatestValue: 0,
    activeValuedCardCount: 0,
    comparableCardCount: 0,
    comparableCostBasis: 0,
    comparableValue: 0,
    unrealizedDifference: 0,
    unrealizedReturnRate: null
  };
}

function currencySummary(map: Map<string, PortfolioCurrencySummary>, currencyValue: string): PortfolioCurrencySummary {
  const currency = normalizeCurrency(currencyValue);
  const current = map.get(currency) ?? blankCurrencySummary(currency);
  map.set(currency, current);
  return current;
}

function groupCards(cards: PortfolioCardRecord[], key: (card: PortfolioCardRecord) => string): PortfolioBreakdown[] {
  const groups = new Map<string, PortfolioBreakdown>();
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

  return [...groups.values()].sort((left, right) => {
    return right.count - left.count
      || (right.values.CNY ?? 0) - (left.values.CNY ?? 0)
      || (right.values.USD ?? 0) - (left.values.USD ?? 0)
      || left.name.localeCompare(right.name);
  });
}

export function buildPortfolioSnapshot(
  cards: PortfolioCardRecord[],
  scope: PortfolioScope = { isFiltered: false, criteria: [] },
  asOf = new Date()
): PortfolioSnapshot {
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
    for (const expense of card.expenses) {
      currencySummary(summaries, expense.currency).expenseAmount += moneyAmount(expense);
    }

    if (!isOwnedCollectionStatus(card.collectionStatus)) continue;

    const currencies = new Set([
      ...card.transactions.map((item) => normalizeCurrency(item.currency)),
      ...card.expenses.map((item) => normalizeCurrency(item.currency))
    ]);
    for (const currency of currencies) {
      const transactions = card.transactions.filter((item) => normalizeCurrency(item.currency) === currency);
      const purchases = transactions.filter((item) => item.kind === "purchase").reduce((sum, item) => sum + moneyAmount(item), 0);
      const refunds = transactions.filter((item) => item.kind === "refund").reduce((sum, item) => sum + moneyAmount(item), 0);
      const expenses = card.expenses
        .filter((item) => normalizeCurrency(item.currency) === currency)
        .reduce((sum, item) => sum + moneyAmount(item), 0);
      currencySummary(summaries, currency).activeCostBasis += Math.max(0, purchases - refunds) + expenses;
    }

    if (valuation) {
      const currency = normalizeCurrency(valuation.currency);
      const summary = currencySummary(summaries, currency);
      const value = moneyAmount(valuation);
      summary.activeLatestValue += value;
      summary.activeValuedCardCount += 1;
      const sameCurrencyTransactions = card.transactions.filter((item) => normalizeCurrency(item.currency) === currency);
      const purchases = sameCurrencyTransactions
        .filter((item) => item.kind === "purchase")
        .reduce((sum, item) => sum + moneyAmount(item), 0);
      const refunds = sameCurrencyTransactions
        .filter((item) => item.kind === "refund")
        .reduce((sum, item) => sum + moneyAmount(item), 0);
      const expenses = card.expenses
        .filter((item) => normalizeCurrency(item.currency) === currency)
        .reduce((sum, item) => sum + moneyAmount(item), 0);
      const hasSale = card.transactions.some((item) => item.kind === "sale");
      if (purchases > 0 && !hasSale) {
        summary.comparableCardCount += 1;
        summary.comparableCostBasis += Math.max(0, purchases - refunds) + expenses;
        summary.comparableValue += value;
      } else if (hasSale) {
        excludedComplexPositionCount += 1;
      }
    }
  }

  const currencies = [...summaries.values()]
    .map((summary) => {
      summary.purchaseAmount = money(summary.purchaseAmount);
      summary.refundAmount = money(summary.refundAmount);
      summary.salesAmount = money(summary.salesAmount);
      summary.expenseAmount = money(summary.expenseAmount);
      summary.netCashInvested = money(summary.purchaseAmount + summary.expenseAmount - summary.refundAmount - summary.salesAmount);
      summary.latestValue = money(summary.latestValue);
      summary.activeCostBasis = money(summary.activeCostBasis);
      summary.activeLatestValue = money(summary.activeLatestValue);
      summary.comparableCostBasis = money(summary.comparableCostBasis);
      summary.comparableValue = money(summary.comparableValue);
      summary.unrealizedDifference = money(summary.comparableValue - summary.comparableCostBasis);
      summary.unrealizedReturnRate = summary.comparableCostBasis > 0
        ? money((summary.unrealizedDifference / summary.comparableCostBasis) * 100)
        : null;
      return summary;
    })
    .sort((left, right) => portfolioCurrencies.indexOf(left.currency as (typeof portfolioCurrencies)[number])
      - portfolioCurrencies.indexOf(right.currency as (typeof portfolioCurrencies)[number]));

  const sortedDates = latestDates.sort((left, right) => left.getTime() - right.getTime());
  return {
    cardCount: cards.length,
    activeCount: activeCards.length,
    soldCount: cards.filter((card) => card.collectionStatus === "sold").length,
    targetCount: cards.filter((card) => card.collectionStatus === "target").length,
    playerCount: new Set(cards.map((card) => card.playerName.trim()).filter(Boolean)).size,
    scope,
    financials: {
      currencies,
      transactionCoverageCount: cards.filter((card) => card.transactions.length > 0).length,
      expenseCoverageCount: cards.filter((card) => card.expenses.length > 0).length,
      valuationCoverageCount,
      freshValuationCount,
      staleValuationCount,
      latestValuationAt: sortedDates.at(-1)?.toISOString() ?? null,
      oldestLatestValuationAt: sortedDates[0]?.toISOString() ?? null,
      valuationSources: [...sourceCounts.entries()]
        .map(([name, count]) => ({ name, count }))
        .sort((left, right) => right.count - left.count || left.name.localeCompare(right.name)),
      excludedComplexPositionCount
    },
    quality: {
      gradedCount: activeCards.filter((card) => Boolean(card.gradingCompany?.trim() || card.grade?.trim())).length,
      rookieCount: activeCards.filter((card) => card.isRookie).length,
      autographCount: activeCards.filter((card) => card.isAutograph).length,
      patchCount: activeCards.filter((card) => card.isPatch).length
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
  const items = Array.isArray(value) ? value : typeof value === "string" ? value.split(/\r?\n|；|;/) : [];
  return items.map((item) => safeText(item, 240).replace(/^[-*\d.、\s]+/, "")).filter(Boolean).slice(0, maxItems);
}

function objectRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function boundedNumber(value: unknown, minimum: number, maximum: number, fallback = 0): number {
  const number = typeof value === "number" && Number.isFinite(value) ? value : fallback;
  return Math.max(minimum, Math.min(maximum, number));
}

function boundedCount(value: unknown, maximum: number): number {
  return Math.round(boundedNumber(value, 0, maximum));
}

function normalizeDateText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function normalizeBreakdowns(value: unknown, maxItems: number, maxCount: number): PortfolioBreakdown[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, maxItems).map((item) => {
    const record = objectRecord(item);
    const rawValues = objectRecord(record.values);
    const values: Record<string, number> = {};
    for (const currency of portfolioCurrencies) {
      if (currency in rawValues) values[currency] = money(boundedNumber(rawValues[currency], 0, 1_000_000_000_000));
    }
    return { name: safeText(record.name, 80), count: boundedCount(record.count, maxCount), values };
  }).filter((item) => item.name && item.count > 0);
}

function normalizePortfolioScope(value: unknown): PortfolioScope {
  const source = Array.isArray(objectRecord(value).criteria) ? objectRecord(value).criteria as unknown[] : [];
  const criteria: PortfolioFilterCriterion[] = [];
  for (const item of source.slice(0, Object.keys(portfolioFilterDefinitions).length)) {
    const record = objectRecord(item);
    const field = safeText(record.field, 40) as PortfolioFilterField;
    if (!(field in portfolioFilterDefinitions)) continue;
    const criterionValue = safeText(record.value, 120);
    if (criterionValue) criteria.push({ field, label: portfolioFilterDefinitions[field], value: displayFilterValue(field, criterionValue) });
  }
  return { isFiltered: criteria.length > 0, criteria };
}

function normalizeCurrencySummaries(value: unknown, cardCount: number): PortfolioCurrencySummary[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.slice(0, portfolioCurrencies.length).map((item) => {
    const record = objectRecord(item);
    const currency = safeText(record.currency, 3).toUpperCase();
    if (!portfolioCurrencies.includes(currency as (typeof portfolioCurrencies)[number]) || seen.has(currency)) return null;
    seen.add(currency);
    const comparableCostBasis = money(boundedNumber(record.comparableCostBasis, 0, 1_000_000_000_000));
    const comparableValue = money(boundedNumber(record.comparableValue, 0, 1_000_000_000_000));
    const difference = money(comparableValue - comparableCostBasis);
    return {
      currency,
      purchaseAmount: money(boundedNumber(record.purchaseAmount, 0, 1_000_000_000_000)),
      refundAmount: money(boundedNumber(record.refundAmount, 0, 1_000_000_000_000)),
      salesAmount: money(boundedNumber(record.salesAmount, 0, 1_000_000_000_000)),
      expenseAmount: money(boundedNumber(record.expenseAmount, 0, 1_000_000_000_000)),
      netCashInvested: money(boundedNumber(record.netCashInvested, -1_000_000_000_000, 1_000_000_000_000)),
      latestValue: money(boundedNumber(record.latestValue, 0, 1_000_000_000_000)),
      valuedCardCount: boundedCount(record.valuedCardCount, cardCount),
      activeCostBasis: money(boundedNumber(record.activeCostBasis, 0, 1_000_000_000_000)),
      activeLatestValue: money(boundedNumber(record.activeLatestValue, 0, 1_000_000_000_000)),
      activeValuedCardCount: boundedCount(record.activeValuedCardCount, cardCount),
      comparableCardCount: boundedCount(record.comparableCardCount, cardCount),
      comparableCostBasis,
      comparableValue,
      unrealizedDifference: difference,
      unrealizedReturnRate: comparableCostBasis > 0 ? money((difference / comparableCostBasis) * 100) : null
    };
  }).filter((item): item is PortfolioCurrencySummary => item !== null);
}

export function normalizePortfolioSnapshot(value: unknown): PortfolioSnapshot {
  const snapshot = objectRecord(value);
  const cardCountValue = snapshot.cardCount;
  if (typeof cardCountValue !== "number" || !Number.isFinite(cardCountValue) || cardCountValue < 1 || cardCountValue > 100000) {
    throw new Error("当前组合没有可分析的卡片，或卡片数量异常。");
  }
  const cardCount = Math.round(cardCountValue);
  const activeCount = boundedCount(snapshot.activeCount, cardCount);
  const financials = objectRecord(snapshot.financials);
  const quality = objectRecord(snapshot.quality);
  const sources = Array.isArray(financials.valuationSources) ? financials.valuationSources : [];
  return {
    cardCount,
    activeCount,
    soldCount: boundedCount(snapshot.soldCount, cardCount),
    targetCount: boundedCount(snapshot.targetCount, cardCount),
    playerCount: boundedCount(snapshot.playerCount, cardCount),
    scope: normalizePortfolioScope(snapshot.scope),
    financials: {
      currencies: normalizeCurrencySummaries(financials.currencies, cardCount),
      transactionCoverageCount: boundedCount(financials.transactionCoverageCount, cardCount),
      expenseCoverageCount: boundedCount(financials.expenseCoverageCount, cardCount),
      valuationCoverageCount: boundedCount(financials.valuationCoverageCount, cardCount),
      freshValuationCount: boundedCount(financials.freshValuationCount, cardCount),
      staleValuationCount: boundedCount(financials.staleValuationCount, cardCount),
      latestValuationAt: normalizeDateText(financials.latestValuationAt),
      oldestLatestValuationAt: normalizeDateText(financials.oldestLatestValuationAt),
      valuationSources: sources.slice(0, 5).map((item) => {
        const record = objectRecord(item);
        return { name: safeText(record.name, 40), count: boundedCount(record.count, cardCount) };
      }).filter((item) => item.name && item.count > 0),
      excludedComplexPositionCount: boundedCount(financials.excludedComplexPositionCount, activeCount)
    },
    quality: {
      gradedCount: boundedCount(quality.gradedCount, activeCount),
      rookieCount: boundedCount(quality.rookieCount, activeCount),
      autographCount: boundedCount(quality.autographCount, activeCount),
      patchCount: boundedCount(quality.patchCount, activeCount)
    },
    sports: normalizeBreakdowns(snapshot.sports, 10, cardCount),
    players: normalizeBreakdowns(snapshot.players, 12, cardCount),
    statuses: normalizeBreakdowns(snapshot.statuses, 10, cardCount)
  };
}

export function normalizePortfolioAnalysis(value: unknown): PortfolioAnalysis {
  if (!value || typeof value !== "object") throw new Error("AI 组合分析结果格式无效。");
  const record = value as Record<string, unknown>;
  const nested = record.analysis && typeof record.analysis === "object" ? record.analysis as Record<string, unknown> : record;
  const dimensions = objectRecord(nested.dimensions);
  const scoreValue = Number(nested.score);
  if (!Number.isFinite(scoreValue)) throw new Error("AI 组合分析结果缺少有效评分。");
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
  if (!result.positioning || !result.summary || Object.values(result.dimensions).some((text) => !text)
    || !result.strengths.length || !result.risks.length || !result.actions.length) {
    throw new Error("AI 组合分析结果缺少必要内容。");
  }
  return result;
}
