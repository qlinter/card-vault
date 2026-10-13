import { normalizeCurrency } from "./financial-history.ts";
import { convertMoney, paymentComponents, type FinancialHistory, type FinancialConfig, type FxRate, type MoneyComponent } from "./financial-currency.ts";
import { projectValuations } from "./financial-valuation-projection.ts";
export * from "./financial-currency.ts";
function businessDate(row: {
  occurredAt?: Date;
  createdAt?: Date;
}): Date {
  return row.occurredAt ?? row.createdAt ?? new Date(0);
}
export function reportingHistory<T extends FinancialHistory>(history: T, config: FinancialConfig, asOf = new Date()) {
  const target = normalizeCurrency(config.reportingCurrency);
  const missing = new Set<string>();
  const evidence = new Map<string, FxRate>();
  const convert = (value: MoneyComponent, at: Date) => {
    const result = convertMoney(value, target, at, config.rates);
    if (result.rate)
      evidence.set(result.rate.id, result.rate);
    if (result.amountMinor === null)
      missing.add(`FX ${value.currency} → ${target} · ${at.toISOString().slice(0, 10)}`);
    return result.amountMinor;
  };
  const transactions = history.transactions.filter((row) => businessDate(row) <= asOf).map((row) => {
    const amounts = paymentComponents(row).map((value) => convert(value, businessDate(row)));
    if (row.amountKnown === false)
      missing.add(`COST · ${businessDate(row).toISOString().slice(0, 10)}`);
    return { ...row, currency: target, paymentsJson: null, amountMinor: amounts.reduce<bigint>((sum, value) => sum + (value ?? 0n), 0n), amountKnown: row.amountKnown !== false && amounts.every((value) => value !== null) };
  });
  const expenses = history.expenses.filter((row) => businessDate(row) <= asOf).map((row) => {
    const amount = convert(row, businessDate(row));
    if (row.amountKnown === false)
      missing.add(`COST · ${businessDate(row).toISOString().slice(0, 10)}`);
    return { ...row, currency: target, amountMinor: amount ?? 0n, amountKnown: amount !== null && row.amountKnown !== false };
  });
  const holdingQuantity = history.transactions.length > 0
    ? transactions.reduce((quantity, row) => quantity + (row.kind === "sale" ? -1 : 1) * (row.quantity ?? 1), 0)
    : history.holdingQuantity;
  const collectionStatus = history.collectionStatus === "sold" && (holdingQuantity ?? 0) > 0 ? "holding" : history.collectionStatus;
  if (history.transactions.length === 0 && ((holdingQuantity ?? 0) > 0 || expenses.length > 0 || history.collectionStatus === "sold"))
    missing.add("COST · No purchase history");
  const costMissing = [...missing];
  const { valuations, latestOriginal, evidence: valuationEvidence } = projectValuations(history.valuations, target, config.rates, asOf);
  for (const rate of valuationEvidence)
    evidence.set(rate.id, rate);
  // Historical quotes remain available to charts, but a closed position does
  // not need a current valuation rate to report its realized return.
  if (latestOriginal && holdingQuantity !== 0)
    convert(latestOriginal, latestOriginal.valuedAt);
  return { ...history, holdingQuantity, collectionStatus, transactions: transactions as T["transactions"], expenses: expenses as T["expenses"], valuations: valuations as T["valuations"], costMissing, missing: [...missing], evidence: [...evidence.values()], reportingCurrency: target };
}
