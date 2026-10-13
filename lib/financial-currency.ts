import { normalizeCurrency } from "./financial-history.ts";
export const accountingVersion = "physical-position-v2";
export type MoneyComponent = {
  currency: string;
  amountMinor: bigint;
};
export type FinancialTransaction = MoneyComponent & {
  kind: string;
  quantity?: number;
  occurredAt?: Date;
  createdAt?: Date;
  paymentsJson?: string | null;
  amountKnown?: boolean;
};
export type FinancialExpense = MoneyComponent & {
  context?: string;
  occurredAt?: Date;
  createdAt?: Date;
  amountKnown?: boolean;
};
export type FinancialValuation = MoneyComponent & {
  valuedAt: Date;
  createdAt: Date;
  source?: string;
};
export type FxRate = {
  id: string;
  effectiveDate: string;
  rateMicros: bigint;
  source: string;
  revision: number;
};
export type FinancialConfig = {
  reportingCurrency: string;
  rates: FxRate[];
};
export type FinancialHistory = {
  transactions: FinancialTransaction[];
  expenses: FinancialExpense[];
  valuations: FinancialValuation[];
  holdingQuantity?: number;
  collectionStatus?: string;
};
export function paymentComponents(row: MoneyComponent & {
  paymentsJson?: string | null;
}): MoneyComponent[] {
  const primary = { currency: normalizeCurrency(row.currency), amountMinor: row.amountMinor };
  if (!row.paymentsJson)
    return [primary];
  const values: unknown = JSON.parse(row.paymentsJson);
  if (!Array.isArray(values) || values.length > 1)
    throw new Error("付款组成无效 / Invalid payment components");
  const extra = values.map((value) => {
    if (!value || typeof value !== "object" || typeof value.amountMinor !== "string" || !/^\d+$/.test(value.amountMinor))
      throw new Error("付款金额无效 / Invalid payment amount");
    const currency = normalizeCurrency(value.currency);
    if (currency === primary.currency)
      throw new Error("付款币种重复 / Duplicate payment currency");
    return { currency, amountMinor: BigInt(value.amountMinor) };
  });
  return [primary, ...extra];
}
export function parseFxRate(value: string): bigint {
  if (!/^(?:0|[1-9]\d{0,5})(?:\.\d{1,6})?$/.test(value.trim()))
    throw new Error("汇率须为正数，最多六位小数 / Enter a positive rate with up to six decimals");
  const [whole, fraction = ""] = value.trim().split(".");
  const result = BigInt(whole) * 1000000n + BigInt(fraction.padEnd(6, "0"));
  if (result <= 0n)
    throw new Error("汇率必须大于零 / Rate must be positive");
  return result;
}
export function rateForDate(rates: readonly FxRate[], at: Date): FxRate | null {
  const day = at.toISOString().slice(0, 10);
  // Each manually confirmed rate is effective from its date until the next entry.
  let latest: FxRate | null = null;
  for (const rate of rates) {
    if (rate.effectiveDate <= day && (!latest || rate.effectiveDate > latest.effectiveDate
      || (rate.effectiveDate === latest.effectiveDate && rate.revision > latest.revision)))
      latest = rate;
  }
  return latest;
}
export function convertMoney(value: MoneyComponent, target: string, at: Date, rates: readonly FxRate[]) {
  if (normalizeCurrency(value.currency) === target || value.amountMinor === 0n)
    return { amountMinor: value.amountMinor, rate: null };
  const rate = rateForDate(rates, at);
  if (!rate)
    return { amountMinor: null, rate: null };
  const numerator = value.amountMinor * (target === "CNY" ? rate.rateMicros : 1000000n);
  const denominator = target === "CNY" ? 1000000n : rate.rateMicros;
  return { amountMinor: (numerator + denominator / 2n) / denominator, rate };
}
