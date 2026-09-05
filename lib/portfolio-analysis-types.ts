import type { PortfolioScorecardKey, PortfolioSectionKey } from "./portfolio-analysis-protocol.ts";

export type PortfolioMoneyRecord = { amountMinor: bigint; currency: string; occurredAt?: Date; createdAt?: Date };
export type PortfolioTransactionRecord = PortfolioMoneyRecord & { kind: string; quantity?: number; paymentsJson?: string | null; amountKnown?: boolean };
export type PortfolioExpenseRecord = PortfolioMoneyRecord & { kind?: string; context?: string; amountKnown?: boolean };
export type PortfolioValuationRecord = PortfolioMoneyRecord & { valuedAt: Date; createdAt: Date; source: string; available?: boolean };

export type PortfolioCardRecord = {
  id?: string;
  createdAt?: Date;
  playerName: string;
  cardTitle?: string;
  sport: string;
  team?: string | null;
  year?: string | null;
  brand?: string | null;
  productLine?: string | null;
  subsetName?: string | null;
  parallel?: string | null;
  cardNumber?: string | null;
  isSerialNumbered?: boolean;
  serialNumber?: string | null;
  serialRange?: string | null;
  collectionStatus: string;
  holdingQuantity?: number;
  gradingCompany: string | null;
  grade: string | null;
  isRookie: boolean;
  isAutograph: boolean;
  autoType?: string | null;
  isPatch: boolean;
  patchType?: string | null;
  tags?: string | null;
  publicDescription?: string | null;
  imageCount?: number;
  transactions: PortfolioTransactionRecord[];
  expenses: PortfolioExpenseRecord[];
  valuations: PortfolioValuationRecord[];
};

export type PortfolioBreakdown = { name: string; count: number; values: Record<string, number> };
export type PortfolioCurrencySummary = {
  currency: string; purchaseAmount: number | null; salesAmount: number | null; expenseAmount: number | null; inventoryExpenseAmount: number | null; saleExpenseAmount: number | null; netCashInvested: number | null; latestValue: number; valuedCardCount: number; activeCostBasis: number | null; activeLatestValue: number; activeValuedCardCount: number; comparableCardCount: number; comparableCostBasis: number | null; comparableValue: number; realizedCost: number | null; realizedProfit: number | null; unrealizedDifference: number | null; unrealizedReturnRate: number | null; totalProfit: number | null;
};
export type PortfolioSourceBreakdown = { name: string; count: number };
export type PortfolioAllocationBreakdown = PortfolioBreakdown & { countShare: number; valueShare: Record<string, number>; averageValue: Record<string, number>; valuedCount: number };
export type PortfolioAllocation = Record<"bySport" | "byPlayer" | "byTeam" | "byYear" | "byBrand" | "byProductLine" | "bySubsetName" | "byParallel" | "byStatus" | "byGradingCompany" | "byGrade" | "byAutoType" | "byPatchType" | "byTag", PortfolioAllocationBreakdown[]>;
export type PortfolioConcentrationDimension = { top1CountShare: number; top3CountShare: number; top1ValueShare: Record<string, number>; top3ValueShare: Record<string, number>; hhiByCurrency: Record<string, number> };
export type PortfolioConcentration = Record<"player" | "sport" | "team" | "brand" | "productLine", PortfolioConcentrationDimension>;
export type PortfolioTimeSeriesPoint = { month: string; count: number; values: Record<string, number> };
export type PortfolioAttentionItem = { type: "missing_valuation" | "stale_valuation" | "missing_transaction" | "missing_image" | "incomplete_data"; priority: "high" | "medium" | "low"; count: number };
export type PortfolioTopPosition = { playerName: string; cardTitle: string; sport: string; team: string | null; year: string | null; brand: string | null; productLine: string | null; subsetName: string | null; parallel: string | null; collectionStatus: string; gradingCompany: string | null; grade: string | null; isRookie: boolean; isAutograph: boolean; isPatch: boolean; isSerialNumbered: boolean; currency: string; latestValue: number; valuedAt: string; valuationAgeDays: number; fieldCompleteness: number };

export type PortfolioFilterField = "q" | "sport" | "team" | "year" | "brand" | "productLine" | "subsetName" | "parallel" | "cardNumber" | "isSerialNumbered" | "isOneOfOne" | "isRookie" | "isAutograph" | "autoType" | "isPatch" | "patchType" | "isGraded" | "gradingCompany" | "grade" | "certNumber" | "visibility" | "collectionStatus";
export type PortfolioFilterCriterion = { field: PortfolioFilterField; label: string; value: string };
export type PortfolioScope = { isFiltered: boolean; criteria: PortfolioFilterCriterion[] };
export type PortfolioDataSufficiency = "sufficient" | "partial" | "insufficient";
export type PortfolioEvidence = { sourcePath: string; label: string; value: string };
export type PortfolioFinding = { title: string; content: string; confidence: "high" | "medium" | "low"; dataSufficiency: PortfolioDataSufficiency; evidence: PortfolioEvidence[] };
export type PortfolioScorecardItem = { score: number; explanation: string; dataSufficiency: PortfolioDataSufficiency; evidence: PortfolioEvidence[] };
export type PortfolioAnalysisSection = { findings: PortfolioFinding[]; dataSufficiency: PortfolioDataSufficiency };
export type PortfolioAnalysisAttentionItem = { priority: "high" | "medium" | "low"; title: string; reason: string; affectedCount: number; sourcePath: string | null };
export type PortfolioAnalysisAction = { priority: number; action: string; reason: string; expectedBenefit: string; sourcePath: string | null };

export type PortfolioSnapshot = {
  accounting?: { version: string; currency: string; incompleteCardCount: number; missing: string[]; rates: Array<{ id: string; effectiveDate: string; rateMicros: string; revision: number; source: string }> };
  cardCount: number; activeCount: number; soldCount: number; targetCount: number; playerCount: number; scope: PortfolioScope;
  financials: { currencies: PortfolioCurrencySummary[]; transactionCoverageCount: number; expenseCoverageCount: number; valuationCoverageCount: number; freshValuationCount: number; staleValuationCount: number; latestValuationAt: string | null; oldestLatestValuationAt: string | null; valuationSources: PortfolioSourceBreakdown[] };
  quality: { gradedCount: number; rookieCount: number; autographCount: number; patchCount: number; serialNumberedCount: number; gradingCompanies: PortfolioAllocationBreakdown[]; grades: PortfolioAllocationBreakdown[]; autoTypes: PortfolioAllocationBreakdown[]; patchTypes: PortfolioAllocationBreakdown[] };
  sports: PortfolioBreakdown[]; players: PortfolioBreakdown[]; statuses: PortfolioBreakdown[]; allocation: PortfolioAllocation; concentration: PortfolioConcentration;
  coverage: { imageCount: number; imageCoverageCount: number; publicDescriptionCoverageCount: number; coreFieldCompletenessAverage: number; incompleteCardCount: number };
  timeSeries: { purchases: PortfolioTimeSeriesPoint[]; sales: PortfolioTimeSeriesPoint[]; expenses: PortfolioTimeSeriesPoint[]; valuations: PortfolioTimeSeriesPoint[] };
  activitySeries: { purchases: PortfolioTimeSeriesPoint[]; grading: PortfolioTimeSeriesPoint[]; sales: PortfolioTimeSeriesPoint[] };
  attentionItems: PortfolioAttentionItem[]; topPositions: PortfolioTopPosition[];
};

export type PortfolioAnalysis = {
  analysisVersion: 2;
  executiveSummary: { overallScore: number; positioning: string; summary: string; confidence: "high" | "medium" | "low"; dataSufficiency: PortfolioDataSufficiency };
  scorecard: Record<PortfolioScorecardKey, PortfolioScorecardItem>;
  sections: Record<PortfolioSectionKey, PortfolioAnalysisSection>;
  attentionItems: PortfolioAnalysisAttentionItem[]; actionItems: PortfolioAnalysisAction[];
};
