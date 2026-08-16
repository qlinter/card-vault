import { portfolioScorecardKeys, portfolioSectionKeys } from "./portfolio-analysis-protocol.ts";
import { displayPortfolioFilterValue, portfolioFilterDefinitions } from "./portfolio-analysis-scope.ts";
import { emptyAllocation, normalizeConcentration } from "./portfolio-analysis-statistics.ts";
import type {
  PortfolioAnalysis,
  PortfolioAnalysisAction,
  PortfolioAnalysisAttentionItem,
  PortfolioAnalysisSection,
  PortfolioBreakdown,
  PortfolioCurrencySummary,
  PortfolioDataSufficiency,
  PortfolioEvidence,
  PortfolioFilterCriterion,
  PortfolioFilterField,
  PortfolioFinding,
  PortfolioScorecardItem,
  PortfolioScope,
  PortfolioSnapshot,
  PortfolioSourceBreakdown,
} from "./portfolio-analysis-types.ts";

const portfolioCurrencies = ["CNY", "USD"] as const;
const maximumMoney = 1_000_000_000_000;
const maximumCardCount = 100_000;

function money(value: number): number {
  return Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;
}

function safeText(value: unknown, maxLength = 1_200): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
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

function normalizeDateText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function normalizeConfidence(value: unknown): "high" | "medium" | "low" {
  return value === "high" || value === "low" ? value : "medium";
}

function normalizeDataSufficiency(value: unknown): PortfolioDataSufficiency {
  return value === "sufficient" || value === "insufficient" ? value : "partial";
}

function normalizeBreakdowns(value: unknown, maxItems: number, maxCount: number): PortfolioBreakdown[] {
  if (!Array.isArray(value)) return [];

  return value
    .slice(0, maxItems)
    .map((item) => {
      const record = objectRecord(item);
      const rawValues = objectRecord(record.values);
      const values: Record<string, number> = {};

      for (const currency of portfolioCurrencies) {
        if (currency in rawValues) {
          values[currency] = money(boundedNumber(rawValues[currency], 0, maximumMoney));
        }
      }

      return {
        name: safeText(record.name, 80),
        count: boundedCount(record.count, maxCount),
        values,
      };
    })
    .filter((item) => item.name && item.count > 0);
}

function normalizePortfolioScope(value: unknown): PortfolioScope {
  const scope = objectRecord(value);
  const source = Array.isArray(scope.criteria) ? scope.criteria : [];
  const maximumCriteria = Object.keys(portfolioFilterDefinitions).length;
  const criteria = source
    .slice(0, maximumCriteria)
    .map((item): PortfolioFilterCriterion | null => {
      const record = objectRecord(item);
      const field = safeText(record.field, 40) as PortfolioFilterField;
      const valueText = safeText(record.value, 120);

      if (!(field in portfolioFilterDefinitions) || !valueText) return null;

      return {
        field,
        label: portfolioFilterDefinitions[field],
        value: displayPortfolioFilterValue(field, valueText),
      };
    })
    .filter((item): item is PortfolioFilterCriterion => item !== null);

  return { isFiltered: criteria.length > 0, criteria };
}

function normalizeCurrencySummaries(value: unknown, cardCount: number): PortfolioCurrencySummary[] {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  return value
    .slice(0, portfolioCurrencies.length)
    .map((item): PortfolioCurrencySummary | null => {
      const record = objectRecord(item);
      const currency = safeText(record.currency, 3).toUpperCase();
      const supportedCurrency = portfolioCurrencies.includes(
        currency as (typeof portfolioCurrencies)[number],
      );

      if (!supportedCurrency || seen.has(currency)) return null;
      seen.add(currency);

      const comparableCostBasis = money(boundedNumber(record.comparableCostBasis, 0, maximumMoney));
      const comparableValue = money(boundedNumber(record.comparableValue, 0, maximumMoney));
      const unrealizedDifference = money(comparableValue - comparableCostBasis);

      return {
        currency,
        purchaseAmount: money(boundedNumber(record.purchaseAmount, 0, maximumMoney)),
        refundAmount: money(boundedNumber(record.refundAmount, 0, maximumMoney)),
        salesAmount: money(boundedNumber(record.salesAmount, 0, maximumMoney)),
        expenseAmount: money(boundedNumber(record.expenseAmount, 0, maximumMoney)),
        netCashInvested: money(boundedNumber(record.netCashInvested, -maximumMoney, maximumMoney)),
        latestValue: money(boundedNumber(record.latestValue, 0, maximumMoney)),
        valuedCardCount: boundedCount(record.valuedCardCount, cardCount),
        activeCostBasis: money(boundedNumber(record.activeCostBasis, 0, maximumMoney)),
        activeLatestValue: money(boundedNumber(record.activeLatestValue, 0, maximumMoney)),
        activeValuedCardCount: boundedCount(record.activeValuedCardCount, cardCount),
        comparableCardCount: boundedCount(record.comparableCardCount, cardCount),
        comparableCostBasis,
        comparableValue,
        unrealizedDifference,
        unrealizedReturnRate: comparableCostBasis > 0
          ? money(unrealizedDifference / comparableCostBasis * 100)
          : null,
      };
    })
    .filter((item): item is PortfolioCurrencySummary => item !== null);
}

function normalizeValuationSources(value: unknown, cardCount: number): PortfolioSourceBreakdown[] {
  if (!Array.isArray(value)) return [];

  return value
    .slice(0, 5)
    .map((item) => {
      const record = objectRecord(item);
      return {
        name: safeText(record.name, 40),
        count: boundedCount(record.count, cardCount),
      };
    })
    .filter((item) => item.name && item.count > 0);
}

export function normalizePortfolioSnapshot(value: unknown): PortfolioSnapshot {
  const snapshot = objectRecord(value);
  const cardCountValue = snapshot.cardCount;

  if (
    typeof cardCountValue !== "number"
    || !Number.isFinite(cardCountValue)
    || cardCountValue < 1
    || cardCountValue > maximumCardCount
  ) {
    throw new Error("当前组合没有可分析的卡片，或卡片数量异常。");
  }

  const cardCount = Math.round(cardCountValue);
  const activeCount = boundedCount(snapshot.activeCount, cardCount);
  const financials = objectRecord(snapshot.financials);
  const quality = objectRecord(snapshot.quality);

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
      valuationSources: normalizeValuationSources(financials.valuationSources, cardCount),
      excludedComplexPositionCount: boundedCount(financials.excludedComplexPositionCount, activeCount),
    },
    quality: {
      gradedCount: boundedCount(quality.gradedCount, activeCount),
      rookieCount: boundedCount(quality.rookieCount, activeCount),
      autographCount: boundedCount(quality.autographCount, activeCount),
      patchCount: boundedCount(quality.patchCount, activeCount),
      serialNumberedCount: 0,
      gradingCompanies: [],
      grades: [],
      autoTypes: [],
      patchTypes: [],
    },
    sports: normalizeBreakdowns(snapshot.sports, 10, cardCount),
    players: normalizeBreakdowns(snapshot.players, 12, cardCount),
    statuses: normalizeBreakdowns(snapshot.statuses, 10, cardCount),
    allocation: emptyAllocation(),
    concentration: normalizeConcentration(snapshot.concentration, portfolioCurrencies),
    coverage: {
      imageCount: 0,
      imageCoverageCount: 0,
      publicDescriptionCoverageCount: 0,
      coreFieldCompletenessAverage: 0,
      incompleteCardCount: cardCount,
    },
    timeSeries: { purchases: [], sales: [], expenses: [], valuations: [] },
    attentionItems: [],
    topPositions: [],
  };
}

function normalizeEvidence(value: unknown): PortfolioEvidence[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item): PortfolioEvidence | null => {
      const record = objectRecord(item);
      const sourcePath = safeText(record.sourcePath, 120);
      const label = safeText(record.label, 120);
      const evidenceValue = safeText(record.value, 180);

      return sourcePath && label && evidenceValue
        ? { sourcePath, label, value: evidenceValue }
        : null;
    })
    .filter((item): item is PortfolioEvidence => item !== null)
    .slice(0, 3);
}

function normalizeFindings(value: unknown): PortfolioFinding[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item): PortfolioFinding | null => {
      const record = objectRecord(item);
      const title = safeText(record.title, 160);
      const content = safeText(record.content, 240);

      if (!title || !content) return null;

      return {
        title,
        content,
        confidence: normalizeConfidence(record.confidence),
        dataSufficiency: normalizeDataSufficiency(record.dataSufficiency),
        evidence: normalizeEvidence(record.evidence),
      };
    })
    .filter((item): item is PortfolioFinding => item !== null)
    .slice(0, 3);
}

function normalizeScorecardItem(value: unknown, fallbackText: string): PortfolioScorecardItem {
  const record = objectRecord(value);
  return {
    score: Math.round(boundedNumber(record.score, 0, 100)),
    explanation: safeText(record.explanation, 240) || fallbackText,
    dataSufficiency: normalizeDataSufficiency(record.dataSufficiency),
    evidence: normalizeEvidence(record.evidence),
  };
}

function normalizeAnalysisSection(value: unknown): PortfolioAnalysisSection {
  const record = objectRecord(value);
  return {
    findings: normalizeFindings(record.findings),
    dataSufficiency: normalizeDataSufficiency(record.dataSufficiency),
  };
}

function normalizeAnalysisAttentionItems(value: unknown): PortfolioAnalysisAttentionItem[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item): PortfolioAnalysisAttentionItem | null => {
      const record = objectRecord(item);
      const title = safeText(record.title, 160);
      const reason = safeText(record.reason, 240);

      if (!title || !reason) return null;

      return {
        priority: normalizeConfidence(record.priority),
        title,
        reason,
        affectedCount: boundedCount(record.affectedCount, maximumCardCount),
        sourcePath: safeText(record.sourcePath, 120) || null,
      };
    })
    .filter((item): item is PortfolioAnalysisAttentionItem => item !== null)
    .slice(0, 5);
}

function normalizeAnalysisActions(value: unknown): PortfolioAnalysisAction[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item, index): PortfolioAnalysisAction | null => {
      const record = objectRecord(item);
      const action = safeText(record.action, 240);
      const reason = safeText(record.reason, 240);
      const expectedBenefit = safeText(record.expectedBenefit, 240);

      if (!action || !reason || !expectedBenefit) return null;

      return {
        priority: boundedCount(record.priority, 99) || index + 1,
        action,
        reason,
        expectedBenefit,
        sourcePath: safeText(record.sourcePath, 120) || null,
      };
    })
    .filter((item): item is PortfolioAnalysisAction => item !== null)
    .slice(0, 5);
}

export function normalizePortfolioAnalysis(value: unknown): PortfolioAnalysis {
  if (!value || typeof value !== "object") {
    throw new Error("AI analysis result is invalid.");
  }

  const record = value as Record<string, unknown>;
  const nested = record.analysis && typeof record.analysis === "object"
    ? record.analysis as Record<string, unknown>
    : record;

  if (nested.analysisVersion !== 2) {
    throw new Error("AI 分析协议版本无效。");
  }

  const executiveSummary = objectRecord(nested.executiveSummary);
  const scorecard = objectRecord(nested.scorecard);
  const sections = objectRecord(nested.sections);
  const positioning = safeText(executiveSummary.positioning, 120);
  const summary = safeText(executiveSummary.summary, 900);
  const hasCompleteScorecard = portfolioScorecardKeys.every((key) => Object.hasOwn(scorecard, key));
  const hasCompleteSections = portfolioSectionKeys.every((key) => Object.hasOwn(sections, key));

  if (!positioning || !summary || !hasCompleteScorecard || !hasCompleteSections) {
    throw new Error("AI 分析协议缺少新版报告必要内容。");
  }

  return {
    analysisVersion: 2,
    executiveSummary: {
      overallScore: Math.round(boundedNumber(executiveSummary.overallScore, 0, 100)),
      positioning,
      summary,
      confidence: normalizeConfidence(executiveSummary.confidence),
      dataSufficiency: normalizeDataSufficiency(executiveSummary.dataSufficiency),
    },
    scorecard: Object.fromEntries(
      portfolioScorecardKeys.map((key) => [
        key,
        normalizeScorecardItem(scorecard[key], "暂无判断"),
      ]),
    ) as PortfolioAnalysis["scorecard"],
    sections: Object.fromEntries(
      portfolioSectionKeys.map((key) => [key, normalizeAnalysisSection(sections[key])]),
    ) as PortfolioAnalysis["sections"],
    attentionItems: normalizeAnalysisAttentionItems(nested.attentionItems),
    actionItems: normalizeAnalysisActions(nested.actionItems),
  };
}
