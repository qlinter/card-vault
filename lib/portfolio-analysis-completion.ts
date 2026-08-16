import { buildFallbackPortfolioAnalysis } from "./portfolio-analysis-fallback.ts";
import { portfolioScorecardKeys, portfolioSectionKeys } from "./portfolio-analysis-protocol.ts";
import type { PortfolioAnalysis, PortfolioAnalysisSection, PortfolioScorecardItem, PortfolioSnapshot } from "./portfolio-analysis-types.ts";

const placeholderTexts = new Set(["暂无判断", "暂无分析", "暂无建议", "数据不足", "无", "n/a", "na", "-"]);

function isSubstantiveText(value: string): boolean {
  const text = value.trim().toLowerCase();
  return text.length > 1 && !placeholderTexts.has(text) && !/^暂无(?:判断|分析|建议)?[。.]?$/.test(text);
}

function completeScorecardItem(item: PortfolioScorecardItem, fallback: PortfolioScorecardItem): PortfolioScorecardItem {
  if (!isSubstantiveText(item.explanation)) return fallback;
  return { ...item, evidence: item.evidence.length ? item.evidence : fallback.evidence };
}

function completeSection(section: PortfolioAnalysisSection, fallback: PortfolioAnalysisSection): PortfolioAnalysisSection {
  return section.findings.some((finding) => isSubstantiveText(finding.title) && isSubstantiveText(finding.content)) ? section : fallback;
}

/**
 * AI providers occasionally return a structurally valid but content-light report.
 * Preserve substantive AI conclusions and fill only omitted dimensions from local statistics.
 */
export function completePortfolioAnalysis(analysis: PortfolioAnalysis, snapshot: PortfolioSnapshot): PortfolioAnalysis {
  const fallback = buildFallbackPortfolioAnalysis(snapshot);
  return {
    ...analysis,
    scorecard: Object.fromEntries(portfolioScorecardKeys.map((key) => [
      key,
      completeScorecardItem(analysis.scorecard[key], fallback.scorecard[key])
    ])) as PortfolioAnalysis["scorecard"],
    sections: Object.fromEntries(portfolioSectionKeys.map((key) => [
      key,
      completeSection(analysis.sections[key], fallback.sections[key])
    ])) as PortfolioAnalysis["sections"],
    attentionItems: analysis.attentionItems.length ? analysis.attentionItems : fallback.attentionItems,
    actionItems: analysis.actionItems.some((item) => isSubstantiveText(item.action) && isSubstantiveText(item.reason)) ? analysis.actionItems : fallback.actionItems
  };
}
