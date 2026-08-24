import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateCurrencyPosition,
  calculateCurrencyPositionSeries,
  resolvePositionCollectionStatus
} from "../lib/position-accounting.ts";

const at = (value: string) => new Date(`${value}T00:00:00.000Z`);

test("moving average allocates inventory cost across partial sales", () => {
  const position = calculateCurrencyPosition({
    transactions: [
      { kind: "purchase", amountMinor: 20000n, currency: "CNY", quantity: 2, occurredAt: at("2026-01-01") },
      { kind: "sale", amountMinor: 15000n, currency: "CNY", quantity: 1, occurredAt: at("2026-01-03") },
      { kind: "purchase", amountMinor: 5000n, currency: "CNY", quantity: 1, occurredAt: at("2026-01-04") }
    ],
    expenses: [
      { context: "grading", amountMinor: 3000n, currency: "CNY", occurredAt: at("2026-01-02") },
      { context: "sale", amountMinor: 1000n, currency: "CNY", occurredAt: at("2026-01-03") }
    ],
    valuations: [
      { amountMinor: 10000n, currency: "CNY", valuedAt: at("2026-01-05"), createdAt: at("2026-01-05") }
    ]
  }, "CNY");

  assert.equal(position.purchasedQuantity, 3);
  assert.equal(position.soldQuantity, 1);
  assert.equal(position.remainingQuantity, 2);
  assert.equal(position.purchaseExpenseMinor, 0n);
  assert.equal(position.gradingExpenseMinor, 3000n);
  assert.equal(position.realizedCostMinor, 11500n);
  assert.equal(position.remainingCostMinor, 16500n);
  assert.equal(position.averageCostMinor, 8250n);
  assert.equal(position.netSaleAmountMinor, 14000n);
  assert.equal(position.realizedProfitMinor, 2500n);
  assert.equal(position.currentValueMinor, 20000n);
  assert.equal(position.unrealizedProfitMinor, 3500n);
  assert.equal(position.totalProfitMinor, 6000n);
});

test("position presentation separates cost expenses and produces dated chart points", () => {
  const history = {
    transactions: [
      { kind: "purchase", amountMinor: 20000n, currency: "CNY", quantity: 2, occurredAt: at("2026-01-01") },
      { kind: "sale", amountMinor: 15000n, currency: "CNY", quantity: 1, occurredAt: at("2026-01-04") }
    ],
    expenses: [
      { context: "purchase", amountMinor: 1000n, currency: "CNY", occurredAt: at("2026-01-01") },
      { context: "grading", amountMinor: 3000n, currency: "CNY", occurredAt: at("2026-01-02") },
      { context: "sale", amountMinor: 500n, currency: "CNY", occurredAt: at("2026-01-04") }
    ],
    valuations: [
      { amountMinor: 14000n, currency: "CNY", valuedAt: at("2026-01-03"), createdAt: at("2026-01-03") }
    ]
  };
  const position = calculateCurrencyPosition(history, "CNY");
  assert.equal(position.purchaseExpenseMinor, 1000n);
  assert.equal(position.gradingExpenseMinor, 3000n);
  assert.equal(position.inventoryExpenseMinor, 4000n);
  assert.equal(position.saleExpenseMinor, 500n);

  const series = calculateCurrencyPositionSeries(history, "CNY");
  assert.deepEqual(series.map((point) => point.type), [
    "purchase",
    "inventory_expense",
    "inventory_expense",
    "valuation",
    "sale",
    "sale_expense"
  ]);
  assert.equal(series[3].currentValueMinor, 28000n);
  assert.equal(series.at(-1)?.remainingQuantity, 1);
  assert.equal(series.at(-1)?.remainingCostMinor, 12000n);
});

test("selling more than the current holding is rejected", () => {
  assert.throws(() => calculateCurrencyPosition({
    transactions: [
      { kind: "purchase", amountMinor: 10000n, currency: "CNY", quantity: 1, occurredAt: at("2026-01-01") },
      { kind: "sale", amountMinor: 20000n, currency: "CNY", quantity: 2, occurredAt: at("2026-01-02") }
    ],
    expenses: []
  }, "CNY"), /超过当前 CNY 持仓/);
});

test("collection status follows a fully sold or repurchased position", () => {
  const expenses: [] = [];
  const soldHistory = {
    transactions: [
      { kind: "purchase", amountMinor: 10000n, currency: "CNY", quantity: 1, occurredAt: at("2026-01-01") },
      { kind: "sale", amountMinor: 15000n, currency: "CNY", quantity: 1, occurredAt: at("2026-01-02") }
    ],
    expenses
  };
  assert.equal(resolvePositionCollectionStatus("holding", soldHistory), "sold");
  assert.equal(resolvePositionCollectionStatus("listed", soldHistory), "sold");
  assert.equal(resolvePositionCollectionStatus("sold", {
    transactions: [...soldHistory.transactions, { kind: "purchase", amountMinor: 12000n, currency: "CNY", quantity: 1, occurredAt: at("2026-01-03") }],
    expenses
  }), "holding");
});
