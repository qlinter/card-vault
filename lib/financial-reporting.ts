import { normalizeCurrency, selectLatestValuation } from "./financial-history.ts";

export const accountingVersion = "physical-position-v2";
export type MoneyComponent = { currency: string; amountMinor: bigint };
export type FinancialTransaction = MoneyComponent & {
  kind: string; quantity?: number; occurredAt?: Date; createdAt?: Date;
  paymentsJson?: string | null; amountKnown?: boolean;
};
export type FinancialExpense = MoneyComponent & { context?: string; occurredAt?: Date; createdAt?: Date; amountKnown?: boolean };
export type FinancialValuation = MoneyComponent & { valuedAt: Date; createdAt: Date; source?: string };
export type FxRate = { id: string; effectiveDate: string; rateMicros: bigint; source: string; revision: number };
export type FinancialConfig = { reportingCurrency: string; rates: FxRate[] };
export type FinancialHistory = { transactions: FinancialTransaction[]; expenses: FinancialExpense[]; valuations: FinancialValuation[]; holdingQuantity?: number; collectionStatus?: string };

export function paymentComponents(row: MoneyComponent & { paymentsJson?: string | null }): MoneyComponent[] {
  const primary = { currency: normalizeCurrency(row.currency), amountMinor: row.amountMinor };
  if (!row.paymentsJson) return [primary];
  const values: unknown = JSON.parse(row.paymentsJson);
  if (!Array.isArray(values) || values.length > 1) throw new Error("付款组成无效 / Invalid payment components");
  const extra = values.map((value) => {
    if (!value || typeof value !== "object" || typeof value.amountMinor !== "string" || !/^\d+$/.test(value.amountMinor)) throw new Error("付款金额无效 / Invalid payment amount");
    const currency = normalizeCurrency(value.currency);
    if (currency === primary.currency) throw new Error("付款币种重复 / Duplicate payment currency");
    return { currency, amountMinor: BigInt(value.amountMinor) };
  });
  return [primary, ...extra];
}

export function businessDate(row: { occurredAt?: Date; createdAt?: Date }): Date {
  return row.occurredAt ?? row.createdAt ?? new Date(0);
}

export function parseFxRate(value: string): bigint {
  if (!/^(?:0|[1-9]\d{0,5})(?:\.\d{1,6})?$/.test(value.trim())) throw new Error("汇率须为正数，最多六位小数 / Enter a positive rate with up to six decimals");
  const [whole, fraction = ""] = value.trim().split(".");
  const result = BigInt(whole) * 1000000n + BigInt(fraction.padEnd(6, "0"));
  if (result <= 0n) throw new Error("汇率必须大于零 / Rate must be positive");
  return result;
}

export function rateForDate(rates: readonly FxRate[], at: Date): FxRate | null {
  const day = at.toISOString().slice(0, 10);
  // Each manually confirmed rate is effective from its date until the next entry.
  return [...rates].filter((rate) => rate.effectiveDate <= day)
    .sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate) || b.revision - a.revision)[0] ?? null;
}

export function convertMoney(value: MoneyComponent, target: string, at: Date, rates: readonly FxRate[]) {
  if (normalizeCurrency(value.currency) === target || value.amountMinor === 0n) return { amountMinor: value.amountMinor, rate: null };
  const rate = rateForDate(rates, at);
  if (!rate) return { amountMinor: null, rate: null };
  const numerator = value.amountMinor * (target === "CNY" ? rate.rateMicros : 1000000n);
  const denominator = target === "CNY" ? 1000000n : rate.rateMicros;
  return { amountMinor: (numerator + denominator / 2n) / denominator, rate };
}

export function reportingHistory<T extends FinancialHistory>(history: T, config: FinancialConfig, asOf = new Date()) {
  const target = normalizeCurrency(config.reportingCurrency);
  const missing = new Set<string>();
  const evidence = new Map<string, FxRate>();
  const convert = (value: MoneyComponent, at: Date) => {
    const result = convertMoney(value, target, at, config.rates);
    if (result.rate) evidence.set(result.rate.id, result.rate);
    if (result.amountMinor === null) missing.add(`FX ${value.currency} → ${target} · ${at.toISOString().slice(0, 10)}`);
    return result.amountMinor;
  };
  const transactions = history.transactions.filter((row) => businessDate(row) <= asOf).map((row) => {
    const amounts = paymentComponents(row).map((value) => convert(value, businessDate(row)));
    if (row.amountKnown === false) missing.add(`COST · ${businessDate(row).toISOString().slice(0, 10)}`);
    return { ...row, currency: target, paymentsJson: null, amountMinor: amounts.reduce<bigint>((sum, value) => sum + (value ?? 0n), 0n), amountKnown: row.amountKnown !== false && amounts.every((value) => value !== null) };
  });
  const expenses = history.expenses.filter((row) => businessDate(row) <= asOf).map((row) => {
    const amount = convert(row, businessDate(row));
    if (row.amountKnown === false) missing.add(`COST · ${businessDate(row).toISOString().slice(0, 10)}`);
    return { ...row, currency: target, amountMinor: amount ?? 0n, amountKnown: amount !== null && row.amountKnown !== false };
  });
  const holdingQuantity = history.transactions.length > 0
    ? transactions.reduce((quantity, row) => quantity + (row.kind === "sale" ? -1 : 1) * (row.quantity ?? 1), 0)
    : history.holdingQuantity;
  const collectionStatus = history.collectionStatus === "sold" && (holdingQuantity ?? 0) > 0 ? "holding" : history.collectionStatus;
  if (history.transactions.length === 0 && ((holdingQuantity ?? 0) > 0 || expenses.length > 0 || history.collectionStatus === "sold")) missing.add("COST · No purchase history");
  const costMissing = [...missing];
  const originalValuations = history.valuations.filter((row) => row.valuedAt <= asOf);
  // Reconstruct the quote that was available at each business date. A direct quote
  // always takes precedence over an alternative quote in the reporting currency.
  const dates = [...new Set(originalValuations.map((row) => row.valuedAt.getTime()))].sort((a, b) => a - b);
  const seenQuotes = new Set<string>();
  const valuations = dates.flatMap((time) => {
    const available = originalValuations.filter((row) => row.valuedAt.getTime() <= time);
    const quote = selectLatestValuation(available, target) ?? selectLatestValuation(available);
    if (!quote) return [];
    const key = `${quote.currency}:${quote.valuedAt.toISOString()}:${quote.createdAt.toISOString()}`;
    if (seenQuotes.has(key)) return [];
    seenQuotes.add(key);
    const result = convertMoney(quote, target, quote.valuedAt, config.rates);
    if (result.rate) evidence.set(result.rate.id, result.rate);
    // Keep an unavailable marker so an older convertible quote cannot masquerade
    // as the latest quote. Historical cutoffs before this marker still work.
    return [{ ...quote, currency: target, amountMinor: result.amountMinor ?? 0n, available: result.amountMinor !== null }];
  });
  const latestOriginal = selectLatestValuation(originalValuations, target) ?? selectLatestValuation(originalValuations);
  if (latestOriginal) convert(latestOriginal, latestOriginal.valuedAt);
  return { ...history, holdingQuantity, collectionStatus, transactions: transactions as T["transactions"], expenses: expenses as T["expenses"], valuations: valuations as T["valuations"], costMissing, missing: [...missing], evidence: [...evidence.values()], reportingCurrency: target };
}
