import { normalizePortfolioAnalysis } from "./portfolio-analysis-normalization.ts";
import type {
  PortfolioAnalysis,
  PortfolioAnalysisAction,
  PortfolioDataSufficiency,
  PortfolioEvidence,
  PortfolioSnapshot,
} from "./portfolio-analysis-types.ts";

function ratio(count: number, total: number): number {
  return total > 0 ? Math.round(count / total * 100) : 0;
}

function boundedScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function evidence(sourcePath: string, label: string, value: string): PortfolioEvidence {
  return { sourcePath, label, value };
}

function sufficiency(coverage: number): PortfolioDataSufficiency {
  return coverage >= 75 ? "sufficient" : coverage >= 25 ? "partial" : "insufficient";
}

const attentionText = {
  missing_valuation: ["补充缺失估值", "缺少估值会削弱组合价值结构与流动性判断。"],
  stale_valuation: ["更新过期估值", "较早的估值可能不能反映当前记录状态。"],
  missing_transaction: ["补充交易记录", "缺少买入等交易信息会降低财务效率判断的可靠性。"],
  missing_image: ["补充卡片图片", "图片缺失会降低档案完整度和后续核对效率。"],
  incomplete_data: ["完善卡片资料", "核心字段不完整会降低分类和结构分析质量。"],
} as const;

const attentionPriority = { high: 0, medium: 1, low: 2 } as const;

function fallbackActions(snapshot: PortfolioSnapshot): PortfolioAnalysisAction[] {
  const actions: PortfolioAnalysisAction[] = snapshot.attentionItems
    .slice()
    .sort((a, b) => attentionPriority[a.priority] - attentionPriority[b.priority])
    .slice(0, 5)
    .map((item) => ({
      priority: 0,
      action: attentionText[item.type][0],
      reason: attentionText[item.type][1],
      expectedBenefit: "提高后续组合分析的覆盖度与可信度。",
      sourcePath: `attentionItems.${item.type}`,
    }));

  const defaults: Omit<PortfolioAnalysisAction, "priority">[] = [
    {
      action: "建立定期估值复核节奏",
      reason: `当前有 ${snapshot.financials.freshValuationCount}/${snapshot.cardCount} 张卡片具备 90 天内估值。`,
      expectedBenefit: "保持组合价值概览的时效性，并减少过期估值造成的偏差。",
      sourcePath: "financials.freshValuationCount",
    },
    {
      action: "定期检查头部集中度",
      reason: `当前头部球员数量占比为 ${snapshot.concentration.player.top1CountShare}%，前三为 ${snapshot.concentration.player.top3CountShare}%。`,
      expectedBenefit: "帮助确认组合结构是否持续符合当前收藏主题。",
      sourcePath: "concentration.player",
    },
    {
      action: "保持新增卡片档案完整",
      reason: `当前核心字段平均完整度为 ${snapshot.coverage.coreFieldCompletenessAverage}%，图片覆盖 ${snapshot.coverage.imageCoverageCount}/${snapshot.cardCount}。`,
      expectedBenefit: "让后续筛选、统计和 AI 分析持续获得稳定的数据基础。",
      sourcePath: "coverage",
    },
  ];

  for (const item of defaults) {
    if (actions.length >= 3) break;
    if (!actions.some((action) => action.sourcePath === item.sourcePath)) {
      actions.push({ ...item, priority: 0 });
    }
  }

  return actions
    .slice(0, 5)
    .map((item, index) => ({ ...item, priority: index + 1 }));
}

/** Provides a complete, transparent statistical report when all remote AI attempts fail. */
export function buildFallbackPortfolioAnalysis(snapshot: PortfolioSnapshot): PortfolioAnalysis {
  const activeCount = Math.max(snapshot.activeCount, 1);
  const valuationCoverage = ratio(snapshot.financials.valuationCoverageCount, snapshot.cardCount);
  const transactionCoverage = ratio(snapshot.financials.transactionCoverageCount, snapshot.cardCount);
  const freshCoverage = ratio(snapshot.financials.freshValuationCount, snapshot.cardCount);
  const imageCoverage = ratio(snapshot.coverage.imageCoverageCount, snapshot.cardCount);
  const topPlayerShare = snapshot.concentration.player.top1CountShare;
  const topThreePlayerShare = snapshot.concentration.player.top3CountShare;
  const gradedShare = ratio(snapshot.quality.gradedCount, activeCount);
  const featureShare = ratio(
    snapshot.quality.rookieCount
      + snapshot.quality.autographCount
      + snapshot.quality.patchCount
      + snapshot.quality.serialNumberedCount,
    activeCount * 4,
  );

  const structureScore = boundedScore(
    90
      - topPlayerShare * 0.35
      - Math.max(0, topThreePlayerShare - 70) * 0.25
      + Math.min(snapshot.playerCount, 20),
  );
  const financialScore = boundedScore(
    transactionCoverage * 0.45
      + valuationCoverage * 0.4
      + Math.min(
        15,
        snapshot.financials.currencies.reduce(
          (sum, item) => sum + (item.comparableCardCount > 0 ? 7.5 : 0),
          0,
        ),
      ),
  );
  const qualityScore = boundedScore(45 + gradedShare * 0.25 + featureShare * 0.3);
  const liquidityScore = boundedScore(
    20 + freshCoverage * 0.55 + valuationCoverage * 0.25 - topPlayerShare * 0.1,
  );
  const completenessScore = boundedScore(
    snapshot.coverage.coreFieldCompletenessAverage * 0.45
      + imageCoverage * 0.2
      + valuationCoverage * 0.2
      + transactionCoverage * 0.15,
  );
  const overallScore = boundedScore(
    (structureScore + financialScore + qualityScore + liquidityScore + completenessScore) / 5,
  );

  const structureDataSufficiency: PortfolioDataSufficiency = snapshot.playerCount > 1
    ? "sufficient"
    : "partial";
  const financialDataSufficiency = sufficiency(Math.min(transactionCoverage, valuationCoverage));
  const collectibleDataSufficiency = sufficiency(snapshot.coverage.coreFieldCompletenessAverage);
  const liquidityDataSufficiency: PortfolioDataSufficiency = freshCoverage >= 50
    ? "partial"
    : "insufficient";
  const overallDataSufficiency = sufficiency(
    Math.min(valuationCoverage, snapshot.coverage.coreFieldCompletenessAverage),
  );

  const report: PortfolioAnalysis = {
    analysisVersion: 2,
    executiveSummary: {
      overallScore,
      positioning: snapshot.scope.isFiltered ? "当前筛选范围的统计概览" : "完整收藏的统计概览",
      summary: `远程 AI 本次未能稳定返回完整报告，现展示基于本地汇总数据生成的保底分析。组合共 ${snapshot.cardCount} 张，估值覆盖率 ${valuationCoverage}%，交易覆盖率 ${transactionCoverage}%；结论侧重数据整理，不包含外部市场判断。`,
      confidence: "medium",
      dataSufficiency: overallDataSufficiency,
    },
    scorecard: {
      structure: {
        score: structureScore,
        explanation: `头部球员数量占比 ${topPlayerShare}%，前三占比 ${topThreePlayerShare}%。`,
        dataSufficiency: structureDataSufficiency,
        evidence: [
          evidence("concentration.player", "头部球员数量占比", `${topPlayerShare}%`),
        ],
      },
      financialEfficiency: {
        score: financialScore,
        explanation: `交易覆盖率 ${transactionCoverage}%，估值覆盖率 ${valuationCoverage}%；不同币种未合并。`,
        dataSufficiency: financialDataSufficiency,
        evidence: [
          evidence(
            "financials.transactionCoverageCount",
            "有交易记录",
            `${snapshot.financials.transactionCoverageCount}/${snapshot.cardCount}`,
          ),
          evidence(
            "financials.valuationCoverageCount",
            "有估值记录",
            `${snapshot.financials.valuationCoverageCount}/${snapshot.cardCount}`,
          ),
        ],
      },
      collectibleQuality: {
        score: qualityScore,
        explanation: `评级卡占 ${gradedShare}%，特殊属性综合覆盖约 ${featureShare}%。该分数只反映已录入属性。`,
        dataSufficiency: collectibleDataSufficiency,
        evidence: [
          evidence("quality.gradedCount", "评级卡", `${snapshot.quality.gradedCount}/${activeCount}`),
        ],
      },
      liquidity: {
        score: liquidityScore,
        explanation: `新鲜估值覆盖率 ${freshCoverage}%。缺少外部成交频率数据，流动性仅作保守估计。`,
        dataSufficiency: liquidityDataSufficiency,
        evidence: [
          evidence(
            "financials.freshValuationCount",
            "新鲜估值",
            `${snapshot.financials.freshValuationCount}/${snapshot.cardCount}`,
          ),
        ],
      },
      dataCompleteness: {
        score: completenessScore,
        explanation: `核心字段平均完整度 ${snapshot.coverage.coreFieldCompletenessAverage}%，图片覆盖率 ${imageCoverage}%。`,
        dataSufficiency: collectibleDataSufficiency,
        evidence: [
          evidence(
            "coverage.coreFieldCompletenessAverage",
            "核心字段完整度",
            `${snapshot.coverage.coreFieldCompletenessAverage}%`,
          ),
          evidence(
            "coverage.imageCoverageCount",
            "有图片卡片",
            `${snapshot.coverage.imageCoverageCount}/${snapshot.cardCount}`,
          ),
        ],
      },
    },
    sections: {
      structure: {
        dataSufficiency: structureDataSufficiency,
        findings: [
          {
            title: "组合集中度",
            content: `头部球员占比 ${topPlayerShare}%，前三球员合计 ${topThreePlayerShare}%；应结合收藏主题判断集中是否符合预期。`,
            confidence: "high",
            dataSufficiency: structureDataSufficiency,
            evidence: [
              evidence(
                "concentration.player",
                "头部占比",
                `${topPlayerShare}% / ${topThreePlayerShare}%`,
              ),
            ],
          },
        ],
      },
      financials: {
        dataSufficiency: financialDataSufficiency,
        findings: [
          {
            title: "财务数据覆盖",
            content: `交易覆盖 ${transactionCoverage}%，估值覆盖 ${valuationCoverage}%。只对同币种和可比卡片记录进行财务判断。`,
            confidence: "high",
            dataSufficiency: financialDataSufficiency,
            evidence: [
              evidence(
                "financials.currencies",
                "记录币种",
                snapshot.financials.currencies.map((item) => item.currency).join("、") || "暂无",
              ),
            ],
          },
        ],
      },
      collectibleQuality: {
        dataSufficiency: collectibleDataSufficiency,
        findings: [
          {
            title: "已录入收藏属性",
            content: `评级 ${snapshot.quality.gradedCount} 张、新秀 ${snapshot.quality.rookieCount} 张、签名 ${snapshot.quality.autographCount} 张、Patch ${snapshot.quality.patchCount} 张、限量编号 ${snapshot.quality.serialNumberedCount} 张。`,
            confidence: "high",
            dataSufficiency: collectibleDataSufficiency,
            evidence: [evidence("quality", "属性统计", `${activeCount} 张持有范围`)],
          },
        ],
      },
      liquidity: {
        dataSufficiency: liquidityDataSufficiency,
        findings: [
          {
            title: "流动性证据有限",
            content: `新鲜估值覆盖 ${freshCoverage}%，过期估值 ${snapshot.financials.staleValuationCount} 张；没有外部成交频率，不能判断真实变现速度。`,
            confidence: "medium",
            dataSufficiency: liquidityDataSufficiency,
            evidence: [
              evidence(
                "financials.staleValuationCount",
                "过期估值",
                `${snapshot.financials.staleValuationCount} 张`,
              ),
            ],
          },
        ],
      },
      dataQuality: {
        dataSufficiency: collectibleDataSufficiency,
        findings: [
          {
            title: "档案完整度",
            content: `核心字段平均完整度 ${snapshot.coverage.coreFieldCompletenessAverage}%，有图片的卡片 ${snapshot.coverage.imageCoverageCount} 张，待完善 ${snapshot.coverage.incompleteCardCount} 张。`,
            confidence: "high",
            dataSufficiency: collectibleDataSufficiency,
            evidence: [
              evidence(
                "coverage",
                "待完善卡片",
                `${snapshot.coverage.incompleteCardCount} 张`,
              ),
            ],
          },
        ],
      },
    },
    attentionItems: snapshot.attentionItems.slice(0, 5).map((item) => ({
      priority: item.priority,
      title: attentionText[item.type][0],
      reason: attentionText[item.type][1],
      affectedCount: item.count,
      sourcePath: `attentionItems.${item.type}`,
    })),
    actionItems: fallbackActions(snapshot),
  };

  return normalizePortfolioAnalysis(report);
}
