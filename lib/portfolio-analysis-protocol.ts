export const portfolioAnalysisDimensions = [
  {
    id: "structure",
    label: "组合结构",
    subtitle: "配置分布与集中程度",
    scorecardKey: "structure",
    sectionKey: "structure",
    promptFocus: "配置分布与集中度",
  },
  {
    id: "financials",
    label: "财务记录",
    subtitle: "成本、估值与可比数据覆盖",
    scorecardKey: "financialEfficiency",
    sectionKey: "financials",
    promptFocus: "财务记录与可比数据覆盖",
  },
  {
    id: "collectible",
    label: "收藏特征",
    subtitle: "评级与特殊卡片属性",
    scorecardKey: "collectibleQuality",
    sectionKey: "collectibleQuality",
    promptFocus: "已录入收藏特征",
  },
  {
    id: "valuation",
    label: "估值时效",
    subtitle: "估值新鲜度与流动性证据",
    scorecardKey: "liquidity",
    sectionKey: "liquidity",
    promptFocus: "估值时效与流动性证据",
  },
  {
    id: "data",
    label: "档案完整度",
    subtitle: "核心字段、图片与记录质量",
    scorecardKey: "dataCompleteness",
    sectionKey: "dataQuality",
    promptFocus: "档案完整度",
  },
] as const;

export type PortfolioScorecardKey = (typeof portfolioAnalysisDimensions)[number]["scorecardKey"];
export type PortfolioSectionKey = (typeof portfolioAnalysisDimensions)[number]["sectionKey"];

export const portfolioScorecardKeys: readonly PortfolioScorecardKey[] = portfolioAnalysisDimensions
  .map((dimension) => dimension.scorecardKey);
export const portfolioSectionKeys: readonly PortfolioSectionKey[] = portfolioAnalysisDimensions
  .map((dimension) => dimension.sectionKey);
