import { valuationSourceLabels } from "./valuation-sources.js";

export function valuationSourceLabel(source: string): string {
  return valuationSourceLabels[source as keyof typeof valuationSourceLabels] ?? source;
}

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
  marketplace_fee: "销售扣点",
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
  sale: "计入卖出成本"
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
