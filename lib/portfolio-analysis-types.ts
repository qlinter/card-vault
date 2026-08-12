export type PortfolioMoneyRecord = { amountMinor: bigint; currency: string; occurredAt?: Date };
export type PortfolioTransactionRecord = PortfolioMoneyRecord & { kind: string; createdAt?: Date };
export type PortfolioValuationRecord = PortfolioMoneyRecord & { valuedAt: Date; createdAt: Date; source: string };

export type PortfolioCardRecord = {
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
  expenses: PortfolioMoneyRecord[];
  valuations: PortfolioValuationRecord[];
};

export type PortfolioBreakdown = { name: string; count: number; values: Record<string, number> };
export type PortfolioCurrencySummary = {
  currency: string; purchaseAmount: number; refundAmount: number; salesAmount: number; expenseAmount: number; netCashInvested: number; latestValue: number; valuedCardCount: number; activeCostBasis: number; activeLatestValue: number; activeValuedCardCount: number; comparableCardCount: number; comparableCostBasis: number; comparableValue: number; unrealizedDifference: number; unrealizedReturnRate: number | null;
};
export type PortfolioSourceBreakdown = { name: string; count: number };
export type PortfolioAllocationBreakdown = PortfolioBreakdown & { countShare: number; valueShare: Record<string, number>; averageValue: Record<string, number>; valuedCount: number };
export type PortfolioAllocation = Record<"bySport" | "byPlayer" | "byTeam" | "byYear" | "byBrand" | "byProductLine" | "bySubsetName" | "byParallel" | "byStatus" | "byGradingCompany" | "byGrade" | "byAutoType" | "byPatchType" | "byTag", PortfolioAllocationBreakdown[]>;
export type PortfolioConcentrationDimension = { top1CountShare: number; top3CountShare: number; top1ValueShare: Record<string, number>; top3ValueShare: Record<string, number>; hhiByCurrency: Record<string, number> };
export type PortfolioConcentration = Record<"player" | "sport" | "team" | "brand" | "productLine", PortfolioConcentrationDimension>;
export type PortfolioTimeSeriesPoint = { month: string; count: number; values: Record<string, number> };
export type PortfolioAttentionItem = { type: "missing_valuation" | "stale_valuation" | "missing_transaction" | "missing_image" | "incomplete_data"; priority: "high" | "medium" | "low"; count: number };
export type PortfolioTopPosition = { playerName: string; cardTitle: string; sport: string; team: string | null; year: string | null; brand: string | null; productLine: string | null; subsetName: string | null; parallel: string | null; collectionStatus: string; gradingCompany: string | null; grade: string | null; isRookie: boolean; isAutograph: boolean; isPatch: boolean; isSerialNumbered: boolean; currency: string; latestValue: number; valuedAt: string; valuationAgeDays: number; fieldCompleteness: number };

export type PortfolioFilterField = "q" | "sport" | "team" | "year" | "brand" | "productLine" | "subsetName" | "parallel" | "cardNumber" | "serialNumber" | "serialRange" | "isRookie" | "isAutograph" | "autoType" | "isPatch" | "patchType" | "isGraded" | "gradingCompany" | "grade" | "certNumber" | "visibility" | "collectionStatus";
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
  cardCount: number; activeCount: number; soldCount: number; targetCount: number; playerCount: number; scope: PortfolioScope;
  financials: { currencies: PortfolioCurrencySummary[]; transactionCoverageCount: number; expenseCoverageCount: number; valuationCoverageCount: number; freshValuationCount: number; staleValuationCount: number; latestValuationAt: string | null; oldestLatestValuationAt: string | null; valuationSources: PortfolioSourceBreakdown[]; excludedComplexPositionCount: number };
  quality: { gradedCount: number; rookieCount: number; autographCount: number; patchCount: number; serialNumberedCount: number; gradingCompanies: PortfolioAllocationBreakdown[]; grades: PortfolioAllocationBreakdown[]; autoTypes: PortfolioAllocationBreakdown[]; patchTypes: PortfolioAllocationBreakdown[] };
  sports: PortfolioBreakdown[]; players: PortfolioBreakdown[]; statuses: PortfolioBreakdown[]; allocation: PortfolioAllocation; concentration: PortfolioConcentration;
  coverage: { imageCount: number; imageCoverageCount: number; publicDescriptionCoverageCount: number; coreFieldCompletenessAverage: number; incompleteCardCount: number };
  timeSeries: { purchases: PortfolioTimeSeriesPoint[]; sales: PortfolioTimeSeriesPoint[]; expenses: PortfolioTimeSeriesPoint[]; valuations: PortfolioTimeSeriesPoint[] };
  attentionItems: PortfolioAttentionItem[]; topPositions: PortfolioTopPosition[];
};

export type PortfolioAnalysis = {
  analysisVersion: 2;
  executiveSummary: { overallScore: number; positioning: string; summary: string; confidence: "high" | "medium" | "low"; dataSufficiency: PortfolioDataSufficiency };
  scorecard: { structure: PortfolioScorecardItem; financialEfficiency: PortfolioScorecardItem; collectibleQuality: PortfolioScorecardItem; liquidity: PortfolioScorecardItem; dataCompleteness: PortfolioScorecardItem };
  sections: { structure: PortfolioAnalysisSection; financials: PortfolioAnalysisSection; collectibleQuality: PortfolioAnalysisSection; liquidity: PortfolioAnalysisSection; dataQuality: PortfolioAnalysisSection };
  attentionItems: PortfolioAnalysisAttentionItem[]; actionItems: PortfolioAnalysisAction[];
};
