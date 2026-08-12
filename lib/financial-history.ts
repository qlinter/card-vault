export const defaultHistoryCurrency = "CNY";
export const supportedHistoryCurrencies = ["CNY", "USD"] as const;

export const transactionKinds = ["purchase", "sale", "refund"] as const;
export const expenseKinds = [
  "grading",
  "shipping",
  "tax",
  "insurance",
  "storage",
  "marketplace_fee",
  "other"
] as const;
export const valuationSources = ["个人估计", "近期成交", "平台报价"] as const;

export type TransactionKind = (typeof transactionKinds)[number];
export type ExpenseKind = (typeof expenseKinds)[number];
export type ValuationSource = (typeof valuationSources)[number];

export type MoneyInput = {
  amount: string | number;
  currency?: string;
};

export type MoneyValue = {
  amountMinor: bigint;
  currency: string;
};

export function normalizeCurrency(value: string | null | undefined): string {
  const currency = (value ?? defaultHistoryCurrency).trim().toUpperCase();
  if (!supportedHistoryCurrencies.includes(currency as (typeof supportedHistoryCurrencies)[number])) {
    throw new Error("币种仅支持 CNY 或 USD。");
  }
  return currency;
}

export function currencyMinorUnitDigits(currencyValue: string): number {
  normalizeCurrency(currencyValue);
  return 2;
}

function formatMinorParts(amountMinor: bigint, currencyValue: string, grouped: boolean): string {
  const currency = normalizeCurrency(currencyValue);
  const digits = currencyMinorUnitDigits(currency);
  const negative = amountMinor < BigInt(0);
  const absolute = negative ? -amountMinor : amountMinor;
  const scale = BigInt(`1${"0".repeat(digits)}`);
  const rawWhole = absolute / scale;
  const whole = grouped ? rawWhole.toLocaleString("en-US") : String(rawWhole);
  const fraction = `.${String(absolute % scale).padStart(digits, "0")}`;
  return `${currency} ${negative ? "-" : ""}${whole}${fraction}`;
}

export function parseMoneyToMinor(value: string | number, currencyValue = defaultHistoryCurrency): bigint {
  const currency = normalizeCurrency(currencyValue);
  const digits = currencyMinorUnitDigits(currency);
  const raw = typeof value === "number" ? String(value) : value.trim();
  const normalized = raw.replace(/[¥￥,\s]/g, "");
  const pattern = digits === 0
    ? /^(?:0|[1-9]\d*)$/
    : new RegExp(`^(?:0|[1-9]\\d*)(?:\\.\\d{1,${digits}})?$`);
  if (!pattern.test(normalized)) {
    throw new Error(`金额必须是非负数，${currency} 最多保留 ${digits} 位小数。`);
  }
  const [whole, fraction = ""] = normalized.split(".");
  const scale = BigInt(`1${"0".repeat(digits)}`);
  const minorFraction = digits === 0 ? BigInt(0) : BigInt(fraction.padEnd(digits, "0"));
  return BigInt(whole) * scale + minorFraction;
}

export function moneyValue(input: MoneyInput): MoneyValue {
  const currency = normalizeCurrency(input.currency);
  return {
    amountMinor: parseMoneyToMinor(input.amount, currency),
    currency
  };
}

export function assertTransactionKind(value: string): TransactionKind {
  if (!transactionKinds.includes(value as TransactionKind)) {
    throw new Error("不支持的交易类型。");
  }
  return value as TransactionKind;
}

export function assertExpenseKind(value: string): ExpenseKind {
  if (!expenseKinds.includes(value as ExpenseKind)) {
    throw new Error("不支持的费用类型。");
  }
  return value as ExpenseKind;
}

export function assertValuationSource(value: string): ValuationSource {
  if (!valuationSources.includes(value as ValuationSource)) {
    throw new Error("估值来源必须选择个人估计、近期成交或平台报价。");
  }
  return value as ValuationSource;
}

export function assertHistoryDate(value: Date): Date {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new Error("历史记录日期无效。");
  }
  return value;
}

export function normalizeOptionalHistoryText(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed || null;
}

export type HistoryMoneyEntry = {
  amountMinor: bigint;
  currency: string;
};

export type HistoryTotals = Record<string, bigint>;

export type DatedValuation = {
  valuedAt: Date;
  createdAt: Date;
  currency: string;
};

export function selectLatestValuation<T extends DatedValuation>(
  valuations: readonly T[],
  currency?: string
): T | null {
  const normalizedCurrency = currency ? normalizeCurrency(currency) : null;
  let latest: T | null = null;

  for (const valuation of valuations) {
    if (normalizedCurrency && normalizeCurrency(valuation.currency) !== normalizedCurrency) continue;
    if (!latest
      || valuation.valuedAt.getTime() > latest.valuedAt.getTime()
      || (valuation.valuedAt.getTime() === latest.valuedAt.getTime()
        && valuation.createdAt.getTime() > latest.createdAt.getTime())) {
      latest = valuation;
    }
  }

  return latest;
}

export function sumHistoryMoney(entries: readonly HistoryMoneyEntry[]): HistoryTotals {
  return entries.reduce<HistoryTotals>((totals, entry) => {
    const currency = normalizeCurrency(entry.currency);
    totals[currency] = (totals[currency] ?? BigInt(0)) + entry.amountMinor;
    return totals;
  }, {});
}

export function formatMinorMoney(amountMinor: bigint, currencyValue: string): string {
  return formatMinorParts(amountMinor, currencyValue, false);
}

export function formatMinorMoneyGrouped(amountMinor: bigint, currencyValue: string): string {
  return formatMinorParts(amountMinor, currencyValue, true);
}

export function minorMoneyToNumber(amountMinor: bigint, currencyValue: string): number {
  const digits = currencyMinorUnitDigits(currencyValue);
  return Number(amountMinor) / 10 ** digits;
}
