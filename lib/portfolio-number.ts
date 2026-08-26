import { minorMoneyToNumber, normalizeCurrency } from "./financial-history.ts";

export function roundPortfolioValue(value: number): number {
  return Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;
}

export function portfolioMoneyAmount(record: { amountMinor: bigint; currency: string }): number {
  return minorMoneyToNumber(record.amountMinor, normalizeCurrency(record.currency));
}
