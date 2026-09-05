import { formatPercentage } from "./percentage-format.ts";

const moneyFormat = new Intl.NumberFormat("zh-CN", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

const dateFormat = new Intl.DateTimeFormat("zh-CN");
const dateTimeFormat = new Intl.DateTimeFormat("zh-CN", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false
});

export function formatPortfolioMoney(value: number | null, currency: string): string {
  return value === null ? "—" : `${currency} ${moneyFormat.format(value)}`;
}

export function formatSignedPortfolioMoney(value: number | null, currency: string): string {
  if (value === null) return "—";
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${currency} ${sign}${moneyFormat.format(Math.abs(value))}`;
}

export function formatPortfolioCountPercent(count: number, total: number, fallback = "—"): string {
  return total > 0 ? formatPercentage(count / total * 100, { fractionDigits: 0 }) : fallback;
}

export function formatPortfolioDate(value: string | null, fallback = "暂无"): string {
  return value ? dateFormat.format(new Date(value)) : fallback;
}

export function formatPortfolioDateTime(value: string): string {
  return dateTimeFormat.format(new Date(value));
}
