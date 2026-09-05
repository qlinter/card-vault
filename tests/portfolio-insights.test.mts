import assert from "node:assert/strict";
import test from "node:test";
import type { PortfolioCardRecord } from "../lib/portfolio-analysis-types.ts";
import { buildPortfolioSnapshot } from "../lib/portfolio-analysis-snapshot.ts";
import {
  buildPortfolioComparisonPoint,
  buildPortfolioFinancialHistory,
  buildPortfolioPositionReviews,
  buildPortfolioValuationChanges,
  portfolioValuationTotalsAt
} from "../lib/portfolio-insights.ts";

function card(overrides: Partial<PortfolioCardRecord> = {}): PortfolioCardRecord {
  return {
    id: "card-1",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    playerName: "Player A",
    cardTitle: "Card A",
    sport: "Basketball",
    collectionStatus: "holding",
    holdingQuantity: 1,
    gradingCompany: null,
    grade: null,
    isRookie: false,
    isAutograph: false,
    isPatch: false,
    transactions: [],
    expenses: [],
    valuations: [],
    ...overrides
  };
}

test("历史估值按目标日期的最新估值和当时持仓数量计算", () => {
  const cards = [card({
    holdingQuantity: 1,
    transactions: [
      { kind: "purchase", amountMinor: 20000n, currency: "CNY", quantity: 2, occurredAt: new Date("2026-01-05") },
      { kind: "sale", amountMinor: 18000n, currency: "CNY", quantity: 1, occurredAt: new Date("2026-05-01") }
    ],
    valuations: [
      { amountMinor: 10000n, currency: "CNY", valuedAt: new Date("2026-02-01"), createdAt: new Date("2026-02-01"), source: "个人估计" },
      { amountMinor: 15000n, currency: "CNY", valuedAt: new Date("2026-04-01"), createdAt: new Date("2026-04-01"), source: "近期成交" }
    ]
  })];

  assert.deepEqual(portfolioValuationTotalsAt(cards, new Date("2026-03-01")), [
    { currency: "CNY", value: 200, valuedCardCount: 1 }
  ]);
  assert.deepEqual(portfolioValuationTotalsAt(cards, new Date("2026-06-01")), [
    { currency: "CNY", value: 150, valuedCardCount: 1 }
  ]);
});

test("历史重建使用业务日期，不因卡片后来导入而丢失早期记录", () => {
  const importedLater = card({
    createdAt: new Date("2026-08-01"),
    transactions: [{ kind: "purchase", amountMinor: 10000n, currency: "CNY", quantity: 1, occurredAt: new Date("2026-01-05") }],
    valuations: [{ amountMinor: 12000n, currency: "CNY", valuedAt: new Date("2026-02-01"), createdAt: new Date("2026-08-01"), source: "历史回填" }]
  });

  assert.equal(portfolioValuationTotalsAt([importedLater], new Date("2026-03-01"))[0].value, 120);
  assert.equal(buildPortfolioFinancialHistory([importedLater], new Date("2026-03-31"))[2].currencies[0].portfolioValue, 120);
});

test("30/90/180 天变化使用历史组合价值而不是估值录入金额", () => {
  const asOf = new Date("2026-07-01T00:00:00.000Z");
  const changes = buildPortfolioValuationChanges([card({
    transactions: [{ kind: "purchase", amountMinor: 10000n, currency: "CNY", quantity: 1, occurredAt: new Date("2025-12-01") }],
    valuations: [
      { amountMinor: 10000n, currency: "CNY", valuedAt: new Date("2026-01-01"), createdAt: new Date("2026-01-01"), source: "个人估计" },
      { amountMinor: 13000n, currency: "CNY", valuedAt: new Date("2026-05-01"), createdAt: new Date("2026-05-01"), source: "近期成交" },
      { amountMinor: 15000n, currency: "CNY", valuedAt: new Date("2026-06-20"), createdAt: new Date("2026-06-20"), source: "平台报价" }
    ]
  })], asOf);

  assert.deepEqual(changes.map((change) => [change.days, change.currencies[0].baselineValue, change.currencies[0].currentValue]), [
    [30, 130, 150],
    [90, 100, 150],
    [180, 100, 150]
  ]);
  assert.equal(changes[0].currencies[0].changeRate, 15.38);
});

test("连续财务历史按月末重建估值、剩余成本及已实现和未实现盈亏", () => {
  const history = buildPortfolioFinancialHistory([card({
    transactions: [
      { kind: "purchase", amountMinor: 20000n, currency: "CNY", quantity: 2, occurredAt: new Date("2026-01-05") },
      { kind: "sale", amountMinor: 15000n, currency: "CNY", quantity: 1, occurredAt: new Date("2026-03-05") }
    ],
    expenses: [
      { context: "grading", amountMinor: 2000n, currency: "CNY", occurredAt: new Date("2026-01-10") }
    ],
    valuations: [
      { amountMinor: 10000n, currency: "CNY", valuedAt: new Date("2026-02-01"), createdAt: new Date("2026-02-01"), source: "个人估计" },
      { amountMinor: 14000n, currency: "CNY", valuedAt: new Date("2026-04-01"), createdAt: new Date("2026-04-01"), source: "近期成交" }
    ]
  })], new Date("2026-04-30T12:00:00.000Z"));

  assert.deepEqual(history.map((point) => [point.month, point.currencies[0]]), [
    ["2026-01", { currency: "CNY", portfolioValue: null, remainingCost: 220, realizedProfit: 0, unrealizedProfit: null }],
    ["2026-02", { currency: "CNY", portfolioValue: 200, remainingCost: 220, realizedProfit: 0, unrealizedProfit: -20 }],
    ["2026-03", { currency: "CNY", portfolioValue: 100, remainingCost: 110, realizedProfit: 40, unrealizedProfit: -10 }],
    ["2026-04", { currency: "CNY", portfolioValue: 140, remainingCost: 110, realizedProfit: 40, unrealizedProfit: 30 }]
  ]);
});

test("高成本持仓和已售复盘复用移动平均核算结果", () => {
  const reviews = buildPortfolioPositionReviews([
    card({
      id: "holding",
      transactions: [
        { kind: "purchase", amountMinor: 20000n, currency: "CNY", quantity: 2, occurredAt: new Date("2026-01-01") },
        { kind: "sale", amountMinor: 15000n, currency: "CNY", quantity: 1, occurredAt: new Date("2026-02-01") }
      ],
      expenses: [{ context: "grading", amountMinor: 2000n, currency: "CNY", occurredAt: new Date("2026-01-10") }],
      valuations: [{ amountMinor: 14000n, currency: "CNY", valuedAt: new Date("2026-03-01"), createdAt: new Date("2026-03-01"), source: "近期成交" }]
    }),
    card({
      id: "sold",
      playerName: "Player B",
      collectionStatus: "sold",
      holdingQuantity: 0,
      transactions: [
        { kind: "purchase", amountMinor: 10000n, currency: "CNY", quantity: 1, occurredAt: new Date("2026-01-01") },
        { kind: "sale", amountMinor: 16000n, currency: "CNY", quantity: 1, occurredAt: new Date("2026-03-01") }
      ]
    })
  ]);

  assert.deepEqual(reviews.highCostPositions[0], {
    cardId: "holding",
    playerName: "Player A",
    cardTitle: "Card A",
    currency: "CNY",
    quantity: 1,
    remainingCost: 110,
    averageCost: 110,
    currentValue: 140
  });
  assert.equal(reviews.soldReviews[0].cardId, "sold");
  assert.equal(reviews.soldReviews[0].realizedProfit, 60);
  assert.equal(reviews.soldReviews[0].realizedReturnRate, 60);
});

test("比较点保留分币种价值、成本与收益", () => {
  const snapshot = buildPortfolioSnapshot([card({
    transactions: [{ kind: "purchase", amountMinor: 10000n, currency: "CNY", quantity: 1, occurredAt: new Date("2026-01-01") }],
    valuations: [{ amountMinor: 15000n, currency: "CNY", valuedAt: new Date("2026-08-01"), createdAt: new Date("2026-08-01"), source: "个人估计" }]
  })], undefined, new Date("2026-08-25T00:00:00.000Z"));
  const point = buildPortfolioComparisonPoint(snapshot, "全部收藏", new Date("2026-08-25T00:00:00.000Z"));

  assert.equal(point.label, "全部收藏");
  assert.equal(point.currencies[0].activeCostBasis, 100);
  assert.equal(point.capturedAt, "2026-08-25T00:00:00.000Z");
  assert.equal(point.structures.find((item) => item.key === "player")?.items[0].name, "Player A");
  assert.equal(point.structures.find((item) => item.key === "cardType")?.items.length, 4);
});

test("财务历史从业务月份开始并解释估值缺失，后来的报价不倒填", () => {
  const history = buildPortfolioFinancialHistory([card({
    createdAt: new Date("2016-01-01"),
    transactions: [{ kind: "purchase", amountMinor: 10000n, currency: "CNY", quantity: 1, occurredAt: new Date("2025-07-30") }],
    valuations: [{ amountMinor: 12000n, currency: "CNY", valuedAt: new Date("2026-03-13"), createdAt: new Date("2026-03-13"), source: "手工" }]
  })], new Date("2026-03-31"));
  assert.equal(history[0].month, "2025-07");
  const october = history.find(point => point.month === "2025-10")!;
  assert.deepEqual(october.coverage, [{ currency: "CNY", active: 1, valued: 0, costKnown: 1 }]);
  assert.equal(october.currencies[0].portfolioValue, null);
  assert.equal(october.currencies[0].unrealizedProfit, null);
  assert.deepEqual(history.at(-1)!.coverage, [{ currency: "CNY", active: 1, valued: 1, costKnown: 1 }]);
});

test("历史部分估值只扣除对应持仓成本，未报价的成本不变成亏损", () => {
  const quoted = card({
    transactions: [{ kind: "purchase", amountMinor: 10000n, currency: "CNY", quantity: 2, occurredAt: new Date("2026-01-01") }],
    valuations: [{ amountMinor: 7000n, currency: "CNY", valuedAt: new Date("2026-02-01"), createdAt: new Date("2026-02-01"), source: "个人估计" }]
  });
  const unquoted = card({ transactions: [{ kind: "purchase", amountMinor: 90000n, currency: "CNY", quantity: 1, occurredAt: new Date("2026-01-01") }], valuations: [] });
  for (const cards of [[quoted, unquoted], [unquoted, quoted]]) {
    const history = buildPortfolioFinancialHistory(cards, new Date("2026-02-28"));
    assert.equal(history[0].currencies[0].portfolioValue, null);
    assert.equal(history[1].currencies[0].portfolioValue, 140);
    assert.equal(history[1].currencies[0].remainingCost, 1000);
    assert.equal(history[1].currencies[0].unrealizedProfit, 40);
    assert.deepEqual(history[1].coverage, [{ currency: "CNY", active: 2, valued: 1, costKnown: 2 }]);
  }
  quoted.transactions[0].amountKnown = false;
  const last = buildPortfolioFinancialHistory([quoted, unquoted], new Date("2026-02-28")).at(-1)!;
  assert.equal(last.currencies[0].portfolioValue, 140);
  assert.equal(last.currencies[0].unrealizedProfit, null);
});
