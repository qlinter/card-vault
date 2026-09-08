import assert from "node:assert/strict";
import test from "node:test";
import { convertMoney, parseFxRate, paymentComponents, rateForDate, reportingHistory, type FinancialConfig } from "../lib/financial-reporting.ts";
import { calculateCurrencyPosition, calculatePositions } from "../lib/position-accounting.ts";
import { buildReportingPortfolio } from "../lib/portfolio-reporting.ts";
import { normalizePortfolioSnapshot } from "../lib/portfolio-analysis.ts";
import { buildPortfolioFinancialHistory } from "../lib/portfolio-insights.ts";
import { selectLatestValuation } from "../lib/financial-history.ts";

const at = (day: string) => new Date(day + "T00:00:00Z");
const config: FinancialConfig = { reportingCurrency: "CNY", rates: [
  { id: "jan", effectiveDate: "2026-01-01", rateMicros: 7000000n, revision: 1, source: "Manual January" },
  { id: "feb", effectiveDate: "2026-02-01", rateMicros: 7200000n, revision: 1, source: "Manual February" }
] };
const history = () => ({
  transactions: [
    { kind: "purchase", currency: "USD", amountMinor: 10000n, paymentsJson: '[{"currency":"CNY","amountMinor":"10000"}]', quantity: 2, occurredAt: at("2026-01-01"), amountKnown: true },
    { kind: "sale", currency: "CNY", amountMinor: 60000n, paymentsJson: null, quantity: 1, occurredAt: at("2026-02-02"), amountKnown: true }
  ],
  expenses: [
    { context: "grading", currency: "USD", amountMinor: 2000n, occurredAt: at("2026-01-02") },
    { context: "sale", currency: "USD", amountMinor: 1000n, occurredAt: at("2026-02-02") }
  ],
  valuations: [
    { currency: "CNY", amountMinor: 65000n, valuedAt: at("2026-02-03"), createdAt: at("2026-02-03"), source: "Direct quote" },
    { currency: "USD", amountMinor: 11000n, valuedAt: at("2026-03-01"), createdAt: at("2026-03-01"), source: "Alternative quote" }
  ], holdingQuantity: 1
});
const card = () => ({ ...history(), id: "card", playerName: "A", cardTitle: "B", sport: "Basketball", collectionStatus: "holding", gradingCompany: null, grade: null, isRookie: false, isAutograph: false, isPatch: false });

test("historical quote reconstruction matches independent date cutoffs, ties and unavailable quotes", () => {
  const quotes = Array.from({ length: 80 }, (_, index) => ({
    currency: index % 3 ? "USD" : " cny ", amountMinor: BigInt(index * 100),
    valuedAt: at(`2026-01-${String(index % 20 + 1).padStart(2, "0")}`),
    createdAt: new Date(at("2026-02-01").getTime() + index % 4),
    available: index % 11 !== 0, source: `quote-${index}`
  })).reverse();
  // Exact ties deliberately disagree on amount; the first input record wins.
  quotes.unshift({ ...quotes[3], amountMinor: 999n, source: "first exact tie" });
  const unchanged = structuredClone(quotes);
  for (const currency of ["CNY", "USD"]) for (const rates of [[], config.rates]) {
    for (const cutoff of [at("2025-12-31"), at("2026-01-10"), at("2026-02-01")]) {
      const report = reportingHistory({ transactions: [], expenses: [], valuations: quotes }, { reportingCurrency: currency, rates }, cutoff);
      const eligible = quotes.filter(row => row.valuedAt <= cutoff);
      const dates = [...new Set(eligible.map(row => row.valuedAt.getTime()))].sort((a, b) => a - b);
      const expected = new Map();
      for (const time of dates) {
        const available = eligible.filter(row => row.valuedAt.getTime() <= time);
        const quote = selectLatestValuation(available, currency) ?? selectLatestValuation(available);
        if (!quote) continue;
        const key = `${quote.currency}:${quote.valuedAt.toISOString()}:${quote.createdAt.toISOString()}`;
        const converted = convertMoney(quote, currency, quote.valuedAt, rates);
        expected.set(key, { ...quote, currency, amountMinor: converted.amountMinor ?? 0n, available: converted.amountMinor !== null });
      }
      assert.deepEqual(report.valuations, [...expected.values()]);
    }
  }
  assert.deepEqual(quotes, unchanged);
});

test("FX lookup preserves stable ties without mutating unsorted input", () => {
  const rates = [config.rates[1], { ...config.rates[0], id: "first", revision: 3 }, config.rates[0], { ...config.rates[0], id: "tie", revision: 3 }];
  const unchanged = structuredClone(rates);
  assert.equal(rateForDate(rates, at("2026-01-31"))?.id, "first");
  assert.equal(rateForDate(rates, at("2026-02-01"))?.id, "feb");
  assert.deepEqual(rates, unchanged);
});

test("missing FX preserves monthly physical activity and does not erase other months", () => {
  const source = card();
  const result = buildReportingPortfolio([source], { isFiltered: false, criteria: [] }, { ...config, rates: [] }, at("2026-09-08")).snapshot;
  const purchases = result.activitySeries.purchases;
  assert.equal(purchases[0].count, 2);
  assert.deepEqual(purchases[0].missingCurrencies, ["CNY"]);
  assert.equal(purchases[0].values.CNY, undefined);
  assert.equal(result.activitySeries.sales[0].count, 1);
  assert.deepEqual(result.activitySeries.sales[0].missingCurrencies, ["CNY"]); // unknown USD sale expense
  source.expenses = [];
  const withoutExpense = buildReportingPortfolio([source], { isFiltered: false, criteria: [] }, { ...config, rates: [] }, at("2026-09-08")).snapshot;
  assert.equal(withoutExpense.activitySeries.sales[0].values.CNY, 600);
  assert.equal(withoutExpense.timeSeries.sales[0].values.CNY, 600);
});

test("dual payments count physical quantity once; cross-currency sale allocates both cost components", () => {
  const original = calculatePositions(history());
  assert.deepEqual(original.map((p) => p.remainingQuantity), [1, 1]);
  assert.equal(original.find((p) => p.currency === "USD")?.remainingCostMinor, 6000n);
  assert.equal(original.find((p) => p.currency === "CNY")?.remainingCostMinor, 5000n);
  assert.ok(original.every((p) => p.totalProfitMinor === null));
  const report = reportingHistory(history(), config);
  const p = calculateCurrencyPosition(report, "CNY");
  assert.equal(p.remainingQuantity, 1);
  assert.equal(p.remainingCostMinor, 47000n);
  assert.equal(p.realizedCostMinor, 47000n);
  assert.equal(p.saleExpenseMinor, 7200n);
  assert.equal(p.realizedProfitMinor, 5800n);
  assert.equal(p.currentValueMinor, 65000n); // newer USD quote must not double count or replace direct CNY
  assert.equal(p.totalProfitMinor, 23800n);
  assert.deepEqual(report.missing, []);
});

test("rates are date-effective, revisioned and use integer rounding in both directions", () => {
  assert.equal(parseFxRate("7.123456"), 7123456n);
  for (const invalid of ["0", "-1", "NaN", "Infinity", "7.1234567", "1e2"]) assert.throws(() => parseFxRate(invalid));
  assert.equal(rateForDate(config.rates, at("2025-12-31")), null);
  assert.equal(rateForDate(config.rates, at("2026-01-31"))?.id, "jan");
  assert.equal(convertMoney({ currency: "USD", amountMinor: 1n }, "CNY", at("2026-02-01"), config.rates).amountMinor, 7n);
  assert.equal(convertMoney({ currency: "CNY", amountMinor: 10000n }, "USD", at("2026-01-01"), config.rates).amountMinor, 1429n);
  assert.equal(rateForDate([...config.rates, { ...config.rates[0], id: "revision", revision: 2 }], at("2026-01-15"))?.id, "revision");
});

test("a missing historical rate cannot silently produce complete costs or profits", () => {
  const report = reportingHistory(history(), { ...config, rates: [config.rates[1]] });
  assert.ok(report.missing.some((reason) => reason.includes("2026-01-01")));
  const p = calculateCurrencyPosition(report, "CNY");
  assert.equal(p.costComplete, false);
  assert.equal(p.totalProfitMinor, null);
  assert.equal(p.currentValueMinor, 65000n);
});

test("unknown purchase cost differs from a confirmed free gift", () => {
  const source = history(); source.transactions = [ { ...source.transactions[0], amountMinor: 0n, paymentsJson: null, amountKnown: true, quantity: 1 } ]; source.expenses = [];
  assert.equal(calculateCurrencyPosition(reportingHistory(source, { ...config, rates: [] }), "CNY").totalProfitMinor, 65000n);
  source.transactions[0].amountKnown = false;
  assert.equal(calculateCurrencyPosition(reportingHistory(source, config), "CNY").totalProfitMinor, null);
});

test("no direct quote uses alternative quote at its valuation date; missing FX leaves quote unavailable", () => {
  const source = history(); source.valuations = source.valuations.filter((q) => q.currency === "USD");
  assert.equal(calculateCurrencyPosition(reportingHistory(source, config), "CNY").currentValueMinor, 79200n);
  assert.equal(selectLatestValuation(reportingHistory(source, { ...config, rates: [] }).valuations), null);
  assert.equal(reportingHistory(history(), config, at("2025-12-31")).holdingQuantity, 0);
});

test("an unavailable latest FX quote cannot fall back to an earlier known zero", () => {
  const source = history();
  source.valuations = [
    { ...source.valuations[0], currency: "USD", amountMinor: 0n },
    { ...source.valuations[1], currency: "USD", amountMinor: 10000n }
  ];
  const report = reportingHistory(source, { ...config, rates: [] });
  assert.equal(calculateCurrencyPosition(report, "CNY").currentValueMinor, null);
  assert.equal(selectLatestValuation(report.valuations.filter((q) => q.valuedAt < at("2026-03-01")))?.amountMinor, 0n);
});

test("full liquidation conserves rounding residue and rejects overselling in another currency", () => {
  const source = { transactions: [ { kind: "purchase", currency: "USD", amountMinor: 100n, quantity: 3, occurredAt: at("2026-01-01") }, ...[2, 3, 4].map((day) => ({ kind: "sale", currency: "CNY", amountMinor: 500n, quantity: 1, occurredAt: at(`2026-01-0${day}`) })) ], expenses: [], valuations: [] };
  const p = calculateCurrencyPosition(reportingHistory(source, config), "CNY");
  assert.equal(p.remainingCostMinor, 0n); assert.equal(p.realizedCostMinor, 700n); assert.equal(p.totalProfitMinor, 800n);
  source.transactions.push({ ...source.transactions[1] });
  assert.throws(() => calculatePositions(source), /出售数量超过/);
});

test("snapshot saves FX evidence and null completeness; later rate revisions leave it unchanged", () => {
  const first = buildReportingPortfolio([card()], { isFiltered: false, criteria: [] }, config).snapshot;
  const stored = JSON.stringify(first);
  assert.equal(first.financials.currencies[0].totalProfit, 238);
  assert.deepEqual(normalizePortfolioSnapshot(JSON.parse(stored)).accounting, first.accounting);
  const revised = buildReportingPortfolio([card()], first.scope, { ...config, rates: [...config.rates, { ...config.rates[0], id: "jan2", revision: 2, rateMicros: 8000000n }] }).snapshot;
  assert.notEqual(revised.financials.currencies[0].totalProfit, first.financials.currencies[0].totalProfit);
  assert.equal(JSON.stringify(first), stored);
  const incomplete = buildReportingPortfolio([card()], first.scope, { ...config, rates: [] }).snapshot;
  assert.equal(incomplete.financials.currencies[0].totalProfit, null);
  assert.equal(normalizePortfolioSnapshot(JSON.parse(JSON.stringify(incomplete))).financials.currencies[0].totalProfit, null);
  const noQuotes = buildReportingPortfolio([{ ...card(), valuations: [] }], first.scope, config).snapshot;
  assert.equal(noQuotes.financials.currencies[0].activeCostBasis, 470);
  assert.equal(noQuotes.financials.currencies[0].totalProfit, null);
});

test("historical chart leaves missing cost and return as gaps", () => {
  const result = buildReportingPortfolio([card()], { isFiltered: false, criteria: [] }, { ...config, rates: [] });
  const points = buildPortfolioFinancialHistory(result.cards, at("2026-03-31"));
  assert.equal(points.at(-1)?.currencies[0].remainingCost, null);
  assert.equal(points.at(-1)?.currencies[0].unrealizedProfit, null);
});

test("malformed or duplicate payment components are rejected", () => {
  for (const paymentsJson of ['[{"currency":"USD","amountMinor":"10"}]', '[{"currency":"CNY","amountMinor":"-1"}]', '{}', '[{},{}]']) {
    assert.throws(() => paymentComponents({ currency: "USD", amountMinor: 1n, paymentsJson }));
  }
});

test("missing valuation FX does not hide known purchase cost or realized results", () => {
  const source = { ...card(), transactions: [{ kind: "purchase", currency: "CNY", amountMinor: 10000n, quantity: 1, occurredAt: at("2026-01-01") }], expenses: [], valuations: history().valuations.filter((q) => q.currency === "USD") };
  const result = buildReportingPortfolio([source], { isFiltered: false, criteria: [] }, { ...config, rates: [] });
  assert.equal(result.snapshot.financials.currencies[0].activeCostBasis, 100);
  assert.equal(result.snapshot.financials.currencies[0].realizedProfit, 0);
  assert.equal(result.snapshot.financials.currencies[0].totalProfit, null);
});

test("incomplete card references keep distinct IDs and combine cost and valuation issues", () => {
  const missing = { ...card(), transactions: [], expenses: [], valuations: [] };
  const result = buildReportingPortfolio([{ ...missing, id: "first" }, { ...missing, id: "second" }, { ...card(), id: "complete" }], { isFiltered: false, criteria: [] }, config, at("2026-09-07"));
  assert.equal(result.snapshot.accounting?.incompleteCardCount, 2);
  assert.deepEqual(result.incompleteCards.map(row => row.id), ["first", "second"]);
  for (const item of result.incompleteCards) {
    assert.equal(item.playerName, "A");
    assert.equal(item.cardTitle, "B");
    assert.ok(item.reasons.some(reason => reason.startsWith("COST")));
    assert.ok(item.reasons.includes("VALUATION"));
  }
});
