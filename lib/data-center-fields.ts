export const importFields = {
  id: "卡片 ID", playerName: "卡片主体", cardTitle: "卡片名称", sport: "运动类型", team: "Team", year: "年份", brand: "品牌", productLine: "产品线", subsetName: "子系列", parallel: "平行版本", cardNumber: "卡号", serialNumber: "编号", serialRange: "编号范围", gradingCompany: "评级机构", grade: "评级", certNumber: "证书号", gradingLink: "评级链接", visibility: "公开状态", collectionStatus: "收藏状态", tags: "标签", publicDescription: "展示描述", notes: "备注", isRookie: "新秀卡", isAutograph: "签字卡", isPatch: "Patch", isSerialNumbered: "限量编号", autoType: "签字类型", patchType: "Patch 类型", initialQuantity: "初始数量", purchaseDate: "购买日期", purchasePrice: "购买价格", historyCurrency: "币种", currentValue: "估值", valuationDate: "估值日期", valuationSource: "估值来源"
} as const;
export type ImportField = keyof typeof importFields;
export type ImportMapping = Record<string, ImportField | "">;
export function guessMapping(headers: string[]): ImportMapping {
  return Object.fromEntries(headers.map(header => [header, Object.entries(importFields).find(([key, label]) => key === header || label === header)?.[0] ?? ""])) as ImportMapping;
}
