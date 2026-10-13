import { normalizeCurrency } from "./financial-history.ts";
import { convertMoney, type FinancialValuation, type FxRate } from "./financial-currency.ts";
/** Project historical quotes while preserving direct-currency precedence and unavailable markers. */
export function projectValuations(source: FinancialValuation[], target: string, rates: FxRate[], asOf: Date) {
  const evidence = new Map<string, FxRate>();
  const originalValuations = source.filter((row) => row.valuedAt <= asOf)
    .sort((a, b) => a.valuedAt.getTime() - b.valuedAt.getTime() || b.createdAt.getTime() - a.createdAt.getTime());
  // Reconstruct the quote available at each business date. A quote in the
  // reporting currency always takes precedence over an alternative-currency quote.
  const seenQuotes = new Set<string>();
  const valuations: Array<FinancialValuation & {
    available: boolean;
  }> = [];
  let direct: (FinancialValuation & {
    available?: boolean;
  }) | undefined;
  let latestOriginal: FinancialValuation | undefined;
  // Sweep each date once. Newest creation wins within a date; stable sorting
  // preserves input order for exact ties, just like selectLatestValuation.
  for (let index = 0; index < originalValuations.length;) {
    const latest: FinancialValuation & {
      available?: boolean;
    } = originalValuations[index];
    const time = latest.valuedAt.getTime();
    let foundDirect = false;
    do {
      const row = originalValuations[index++];
      if (normalizeCurrency(row.currency) === target && !foundDirect) {
        direct = row;
        foundDirect = true;
      }
    } while (index < originalValuations.length && originalValuations[index].valuedAt.getTime() === time);
    const quote = direct && direct.available !== false ? direct : latest.available !== false ? latest : undefined;
    latestOriginal = quote;
    if (!quote)
      continue;
    const key = `${quote.currency}:${quote.valuedAt.toISOString()}:${quote.createdAt.toISOString()}`;
    if (seenQuotes.has(key))
      continue;
    seenQuotes.add(key);
    const result = convertMoney(quote, target, quote.valuedAt, rates);
    if (result.rate)
      evidence.set(result.rate.id, result.rate);
    // Keep an unavailable marker so an older convertible quote cannot masquerade
    // as the latest quote. Historical cutoffs before this marker still work.
    valuations.push({ ...quote, currency: target, amountMinor: result.amountMinor ?? 0n, available: result.amountMinor !== null });
  }
  return { valuations, latestOriginal, evidence: [...evidence.values()] };
}
