import type { PortfolioFilterCriterion, PortfolioFilterField, PortfolioScope } from "./portfolio-analysis.ts";

export const portfolioFilterDefinitions = {
  q: "搜索关键词",
  sport: "运动类型",
  team: "Team",
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

export type PortfolioFilterInput = Record<string, string | undefined>;

const maximumFilterValueLength = 160;

export function normalizePortfolioFilterInput(value: unknown): PortfolioFilterInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const source = value as Record<string, unknown>;
  const normalized: PortfolioFilterInput = {};
  for (const field of Object.keys(portfolioFilterDefinitions) as PortfolioFilterField[]) {
    const candidate = source[field];
    if (candidate === undefined || candidate === null || candidate === "") continue;
    if (typeof candidate !== "string") {
      throw new Error(`筛选条件 ${portfolioFilterDefinitions[field]} 格式无效。`);
    }
    const trimmed = candidate.trim();
    if (!trimmed) continue;
    if (trimmed.length > maximumFilterValueLength) {
      throw new Error(`筛选条件 ${portfolioFilterDefinitions[field]} 过长。`);
    }
    normalized[field] = trimmed;
  }
  return normalized;
}

function displayFilterValue(field: PortfolioFilterField, value: string): string {
  if (["isRookie", "isAutograph", "isPatch", "isGraded"].includes(field)) return value === "true" ? "是" : value === "false" ? "否" : value;
  if (field === "visibility") return { private: "私密", public: "公开", linkOnly: "仅链接可见" }[value] ?? value;
  if (field === "collectionStatus") return { holding: "持有中", listed: "在售", grading: "送评中", sold: "已售出", target: "目标卡" }[value] ?? value;
  return value;
}

export function buildPortfolioScope(input: PortfolioFilterInput): PortfolioScope {
  const criteria: PortfolioFilterCriterion[] = [];
  for (const field of Object.keys(portfolioFilterDefinitions) as PortfolioFilterField[]) {
    const value = input[field]?.trim();
    if (value) criteria.push({ field, label: portfolioFilterDefinitions[field], value: displayFilterValue(field, value) });
  }
  return { isFiltered: criteria.length > 0, criteria };
}

export function portfolioScopeInstructions(scope: PortfolioScope): string[] {
  if (!scope.isFiltered || scope.criteria.length === 0) return ["本次没有应用筛选条件，可以把输入数据视为当前完整收藏范围。"];
  const criteria = scope.criteria.map((item) => `${item.label}=${item.value}`).join("、");
  return [
    `本次分析对象是筛选结果，不是完整收藏。筛选条件：${criteria}。`,
    "必须把上述筛选条件视为用户主动设定的研究范围，不得因为被筛选字段在结果中高度集中，就将其判断为集中度风险、结构缺陷或扣分项。",
    "例如筛选条件为“运动类型=足球”时，不得提出“足球卡占比过高”；筛选 Team、球员关键词、年份、评级或签名属性时同理。",
    "组合结构只评价筛选范围内部仍可比较的维度，并明确结论仅适用于当前筛选结果，不得外推到用户的完整收藏。",
    "summary 和 structure 中应明确说明分析基于当前筛选范围。"
  ];
}

export function displayPortfolioFilterValue(field: PortfolioFilterField, value: string): string {
  return displayFilterValue(field, value);
}
