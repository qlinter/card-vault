import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateCurrencyPosition,
  calculateHoldingSnapshots,
  resolvePositionCollectionStatus
} from "../lib/position-accounting.ts";

import { localBusinessDay, storedBusinessDay, transactionDate, currentFinancialCutoff } from "../lib/financial-business-day.ts";

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

  const series = calculateHoldingSnapshots(history, "CNY");
  assert.deepEqual(series.map(point => point.day), ["2026-01-01", "2026-01-02", "2026-01-03", "2026-01-04"]);
  assert.equal(series[0].remainingCostMinor, 21000n);
  assert.equal(series[0].currentValueMinor, null);
  assert.equal(series[2].currentValueMinor, 28000n);
  assert.equal(series[3].currentValueMinor, position.currentValueMinor);
  assert.deepEqual(series[3].quote, { day: "2026-01-03", unitMinor: 14000n });
  assert.equal(series.at(-1)?.remainingQuantity, 1);
  assert.equal(series.at(-1)?.remainingCostMinor, 12000n);
});

test("daily holdings distinguish an absent, zero and unavailable quote through a full sale", () => {
  const history = {
    transactions: [
      { kind: "purchase", currency: "CNY", quantity: 1, amountMinor: 5000n, occurredAt: at("2026-01-01") },
      { kind: "sale", currency: "CNY", quantity: 1, amountMinor: 6500n, occurredAt: at("2026-01-05") }
    ],
    expenses: [],
    valuations: [0n, 0n, 6000n].map((amountMinor, index) => {
      const date = at(`2026-01-0${index + 2}`);
      return { currency: "CNY", amountMinor, available: index !== 1, valuedAt: date, createdAt: date };
    })
  };
  const days = calculateHoldingSnapshots(history, "CNY");
  assert.deepEqual(days.map(day => day.currentValueMinor), [null, 0n, null, 6000n, 0n]);
  assert.deepEqual(days.map(day => day.quote?.unitMinor), [undefined, 0n, null, 6000n, 6000n]);
  assert.equal(days.at(-1)?.remainingCostMinor, 0n);
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

test("gifts share realized P&L with sales without changing sales or purchase volume", () => {
  const trade = (kind:string, amountMinor:bigint, quantity:number,day:number) => ({kind,amountMinor,quantity,currency:"CNY",occurredAt:at("2026-01-0"+day)});
  const history = {expenses:[],transactions:[trade("purchase",20000n,2,1),trade("gift_out",0n,1,2)]};
  const partial = calculateCurrencyPosition(history,"CNY");
  assert.deepEqual([partial.remainingQuantity,partial.realizedProfitMinor,partial.remainingCostMinor,partial.soldQuantity],[1,-10000n,10000n,0]);
  history.transactions.push(trade("gift_in",0n,1,3),trade("sale",16000n,1,4),trade("gift_out",0n,1,5));
  const closed = calculateCurrencyPosition(history,"CNY");
  assert.deepEqual([closed.purchasedQuantity,closed.soldQuantity,closed.grossSaleAmountMinor,closed.realizedProfitMinor,closed.remainingQuantity],[2,1,16000n,-4000n,0]);
  assert.equal(resolvePositionCollectionStatus("holding",history),"gifted");
  history.transactions.push(trade("gift_in",0n,1,6));
  assert.equal(resolvePositionCollectionStatus("gifted",history),"holding");
  assert.equal(calculateCurrencyPosition({transactions:[trade("gift_in",0n,1,1)],expenses:[]},"CNY").costComplete,true);
  assert.throws(()=>calculateCurrencyPosition({transactions:[trade("gift_out",0n,1,1)],expenses:[]},"CNY"));
});

test("daily reports acquire before transferring, regardless of legacy time-of-day", () => {
  const day = at("2026-02-20");
  const history = {expenses:[],transactions:[
    {kind:"gift_out",amountMinor:0n,quantity:1,currency:"CNY",occurredAt:day},
    {kind:"purchase",amountMinor:10000n,quantity:1,currency:"CNY",occurredAt:new Date("2026-02-20T18:00:00Z")}
  ]};
  assert.equal(calculateCurrencyPosition(history,"CNY").realizedProfitMinor,-10000n);
  assert.equal(calculateHoldingSnapshots(history,"CNY").at(-1)?.remainingQuantity,0);
  assert.equal(resolvePositionCollectionStatus("holding",history),"gifted");
});

test("transaction dates use the device calendar and reject dates beyond it", () => {
  const now = new Date(2026,0,1,0,10);
  const today = localBusinessDay(now);
  assert.equal(today.toISOString(),"2026-01-01T00:00:00.000Z");
  assert.equal(storedBusinessDay(currentFinancialCutoff(now)),today.getTime());
  assert.equal(transactionDate(new Date("2026-01-01T11:12:00Z"),today).getTime(),today.getTime());
  assert.throws(()=>transactionDate(at("2026-01-02"),today),/晚于今天/);
});
