export const transactionLabels: Record<string, string> = {
  purchase: "购入",
  sale: "售出"
};

export const expenseKindLabels: Record<string, string> = {
  grading: "评级费",
  shipping: "运费",
  tax: "税费",
  insurance: "保险费",
  storage: "存储费",
  marketplace_fee: "平台费用",
  other: "其他费用"
};

export const expenseContextLabels: Record<string, string> = {
  purchase: "买入成本",
  grading: "评级成本",
  sale: "出售扣费"
};

export const expenseContextInputLabels: Record<string, string> = {
  purchase: "计入买入成本",
  grading: "计入评级成本",
  sale: "从出售收入扣除"
};

export const expenseContextDescriptions: Record<string, string> = {
  purchase: "这笔费用会增加球星卡的持仓成本。",
  grading: "这笔费用会增加球星卡的持仓成本。",
  sale: "这笔费用会从所选出售记录的收入中扣除。"
};

export const positionEventLabels: Record<string, string> = {
  purchase: "购入",
  sale: "售出",
  inventory_expense: "成本费用",
  sale_expense: "出售费用",
  valuation: "估值"
};

export function formatHistoryDateInput(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export function formatHistoryDateLabel(date: Date): string {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "UTC"
  }).format(date);
}
