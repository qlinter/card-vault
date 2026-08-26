import assert from "node:assert/strict";
import test from "node:test";
import { concentrationDimension, monthlyActivitySeries } from "../lib/portfolio-analysis-statistics.ts";
import type { PortfolioCardRecord } from "../lib/portfolio-analysis-types.ts";

test("估值集中度按估值占比排序而不是沿用数量排序", () => {
  const concentration = concentrationDimension([
    { name: "数量较多", count: 5, values: { CNY: 100 }, countShare: 83.33, valueShare: { CNY: 10 }, averageValue: { CNY: 20 }, valuedCount: 5 },
    { name: "单张高值", count: 1, values: { CNY: 900 }, countShare: 16.67, valueShare: { CNY: 90 }, averageValue: { CNY: 900 }, valuedCount: 1 }
  ]);

  assert.equal(concentration.top1CountShare, 83.33);
  assert.equal(concentration.top1ValueShare.CNY, 90);
  assert.equal(concentration.top3ValueShare.CNY, 100);
});

test("活动趋势按买入、评级和出售归集相关费用", () => {
  const card: PortfolioCardRecord = {
    playerName: "Player A",
    cardTitle: "Card A",
    sport: "Basketball",
    collectionStatus: "holding",
    gradingCompany: null,
    grade: null,
    isRookie: false,
    isAutograph: false,
    isPatch: false,
    transactions: [
      { kind: "purchase", amountMinor: 10000n, currency: "CNY", occurredAt: new Date("2026-01-02") },
      { kind: "sale", amountMinor: 20000n, currency: "CNY", occurredAt: new Date("2026-03-02") }
    ],
    expenses: [
      { context: "purchase", amountMinor: 1000n, currency: "CNY", occurredAt: new Date("2026-01-03") },
      { context: "grading", amountMinor: 2000n, currency: "CNY", occurredAt: new Date("2026-02-03") },
      { context: "sale", amountMinor: 1500n, currency: "CNY", occurredAt: new Date("2026-03-03") }
    ],
    valuations: []
  };

  const activity = monthlyActivitySeries([card]);
  assert.deepEqual(activity.purchases, [{ month: "2026-01", count: 2, values: { CNY: 110 } }]);
  assert.deepEqual(activity.grading, [{ month: "2026-02", count: 1, values: { CNY: 20 } }]);
  assert.deepEqual(activity.sales, [{ month: "2026-03", count: 2, values: { CNY: 185 } }]);
});
