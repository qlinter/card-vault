import { selectLatestValuation } from "./financial-history.ts";
import type { PortfolioAttentionItem, PortfolioValuationRecord } from "./portfolio-analysis-types.ts";

export const stalePortfolioValuationDays = 360;

export const portfolioQualityMetrics = [
  { type: "missing_valuation", label: "未估值", issue: "缺少估值", definition: "卡片没有任何估值记录。", priority: "high" },
  { type: "stale_valuation", label: "估值过期", issue: `估值超过 ${stalePortfolioValuationDays} 天`, definition: `卡片的最新估值距当前日期超过 ${stalePortfolioValuationDays} 天。`, priority: "medium" },
  { type: "missing_transaction", label: "无交易", issue: "缺少交易记录", definition: "卡片没有任何买入或出售交易记录。", priority: "medium" },
  { type: "missing_image", label: "无图片", issue: "缺少图片", definition: "卡片没有上传任何卡片图片。", priority: "low" },
  { type: "incomplete_data", label: "资料不完整", issue: "基础资料不完整", definition: "卡片主体、运动类型或卡片标题等基础资料尚未填写完整。", priority: "medium" }
] as const satisfies ReadonlyArray<{
  type: PortfolioAttentionItem["type"];
  label: string;
  issue: string;
  definition: string;
  priority: PortfolioAttentionItem["priority"];
}>;

type PortfolioQualityIssueType = PortfolioAttentionItem["type"];
const portfolioQualityMetricByType = new Map(portfolioQualityMetrics.map((metric) => [metric.type, metric]));

export type PortfolioQualityCard = {
  id: string;
  playerName: string;
  cardTitle: string;
  issues: string[];
  severity: "high" | "medium" | "low";
};

export type PortfolioQualityRecord = {
  id: string;
  playerName: string;
  cardTitle: string;
  sport: string;
  imageCount: number;
  transactionCount: number;
  valuations: PortfolioValuationRecord[];
};

type PortfolioQualityInput = Omit<PortfolioQualityRecord, "id">;

export type PortfolioQualityAssessment = {
  issueTypes: PortfolioQualityIssueType[];
  issues: string[];
  severity: PortfolioQualityCard["severity"];
};

export function assessPortfolioCardQuality(
  card: PortfolioQualityInput,
  asOf = new Date()
): PortfolioQualityAssessment {
  const issueTypes: PortfolioQualityIssueType[] = [];
  const latestValuation = selectLatestValuation(card.valuations);

  if (!latestValuation) {
    issueTypes.push("missing_valuation");
  } else if (asOf.getTime() - latestValuation.valuedAt.getTime() > stalePortfolioValuationDays * 86_400_000) {
    issueTypes.push("stale_valuation");
  }
  if (card.transactionCount === 0) issueTypes.push("missing_transaction");
  if (card.imageCount === 0) issueTypes.push("missing_image");
  if (![card.playerName, card.sport, card.cardTitle].every((value) => value.trim())) {
    issueTypes.push("incomplete_data");
  }

  const issueSet = new Set(issueTypes);
  const severity: PortfolioQualityCard["severity"] = issueSet.has("missing_valuation")
    ? "high"
    : issueTypes.some((type) => portfolioQualityMetricByType.get(type)?.priority === "medium")
      ? "medium"
      : "low";
  return {
    issueTypes,
    issues: issueTypes.map((type) => portfolioQualityMetricByType.get(type)?.issue ?? type),
    severity
  };
}

export function buildPortfolioQualityCards(
  cards: PortfolioQualityRecord[],
  asOf = new Date()
): PortfolioQualityCard[] {
  const qualityCards = cards.map((card): PortfolioQualityCard | null => {
    const { issues, severity } = assessPortfolioCardQuality(card, asOf);

    return issues.length > 0
      ? { id: card.id, playerName: card.playerName, cardTitle: card.cardTitle, issues, severity }
      : null;
  });

  return qualityCards
    .filter((card): card is PortfolioQualityCard => card !== null)
    .sort((left, right) => {
      const rank = { high: 0, medium: 1, low: 2 } as const;
      return rank[left.severity] - rank[right.severity]
        || right.issues.length - left.issues.length
        || left.playerName.localeCompare(right.playerName);
    });
}
