import assert from "node:assert/strict";
import test from "node:test";
import {
  assertExpenseKind,
  assertTransactionKind,
  assertValuationSource,
  formatMinorMoneyGrouped,
  moneyValue,
  normalizeCurrency,
  parseMoneyToMinor,
  selectLatestValuation,
  sumHistoryMoney
} from "../lib/financial-history.ts";

test("money values use exact integer minor units", () => {
  assert.equal(parseMoneyToMinor("0"), BigInt(0));
  assert.equal(parseMoneyToMinor(" 1,234.5 "), BigInt(123450));
  assert.equal(parseMoneyToMinor("￥99.99"), BigInt(9999));
  assert.deepEqual(moneyValue({ amount: "12.30", currency: "usd" }), {
    amountMinor: BigInt(1230),
    currency: "USD"
  });
  assert.equal(parseMoneyToMinor("123", "USD"), BigInt(12300));
});

test("money validation rejects negative, imprecise, and invalid currency values", () => {
  assert.throws(() => parseMoneyToMinor("-1"), /非负数/);
  assert.throws(() => parseMoneyToMinor("1.001"), /2 位小数/);
  assert.throws(() => parseMoneyToMinor("1e3"), /非负数/);
  assert.throws(() => normalizeCurrency("EUR"), /仅支持 CNY 或 USD/);
  assert.throws(() => assertTransactionKind("trade"), /交易类型/);
  assert.throws(() => assertExpenseKind("purchase"), /费用类型/);
  assert.equal(assertValuationSource("平台报价"), "平台报价");
  assert.throws(() => assertValuationSource("拍卖参考"), /估值来源必须选择/);
});

test("history totals never mix currencies", () => {
  assert.deepEqual(
    sumHistoryMoney([
      { amountMinor: BigInt(100), currency: "CNY" },
      { amountMinor: BigInt(250), currency: "cny" },
      { amountMinor: BigInt(900), currency: "USD" }
    ]),
    { CNY: BigInt(350), USD: BigInt(900) }
  );
});

test("latest valuation selection uses business date then creation time without mutating input", () => {
  const older = { amountMinor: 100n, currency: "CNY", valuedAt: new Date("2026-08-01"), createdAt: new Date("2026-08-03") };
  const sameDayEarlier = { amountMinor: 200n, currency: "CNY", valuedAt: new Date("2026-08-10"), createdAt: new Date("2026-08-10T08:00:00Z") };
  const sameDayLatest = { amountMinor: 250n, currency: "CNY", valuedAt: new Date("2026-08-10"), createdAt: new Date("2026-08-10T09:00:00Z") };
  const usd = { amountMinor: 300n, currency: "USD", valuedAt: new Date("2026-08-12"), createdAt: new Date("2026-08-12") };
  const valuations = [sameDayEarlier, older, usd, sameDayLatest];

  assert.equal(selectLatestValuation(valuations), usd);
  assert.equal(selectLatestValuation(valuations, "cny"), sameDayLatest);
  assert.deepEqual(valuations, [sameDayEarlier, older, usd, sameDayLatest]);
  assert.equal(selectLatestValuation([], "CNY"), null);
});

test("grouped money formatting keeps currency labels and thousands separators consistent", () => {
  assert.equal(formatMinorMoneyGrouped(123456789n, "CNY"), "CNY 1,234,567.89");
  assert.equal(formatMinorMoneyGrouped(9876543n, "USD"), "USD 98,765.43");
});
