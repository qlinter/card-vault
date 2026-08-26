import assert from "node:assert/strict";
import test from "node:test";
import { buildPortfolioQualityCards, type PortfolioQualityRecord } from "../lib/portfolio-quality.ts";

function record(overrides: Partial<PortfolioQualityRecord> = {}): PortfolioQualityRecord {
  return {
    id: "card-1",
    playerName: "Player A",
    cardTitle: "Card A",
    sport: "Basketball",
    imageCount: 1,
    transactionCount: 1,
    valuations: [{
      amountMinor: BigInt(10000),
      currency: "CNY",
      valuedAt: new Date("2026-08-01T00:00:00.000Z"),
      createdAt: new Date("2026-08-01T00:00:00.000Z"),
      source: "manual"
    }],
    ...overrides
  };
}

test("组合质量清单忽略资料完整且估值新鲜的卡片", () => {
  const result = buildPortfolioQualityCards([record()], new Date("2026-08-25T00:00:00.000Z"));
  assert.deepEqual(result, []);
});

test("组合质量清单汇总缺少估值、交易和图片的问题", () => {
  const result = buildPortfolioQualityCards([
    record({ id: "missing", valuations: [], transactionCount: 0, imageCount: 0 })
  ], new Date("2026-08-25T00:00:00.000Z"));

  assert.equal(result.length, 1);
  assert.equal(result[0].severity, "high");
  assert.deepEqual(result[0].issues, ["缺少估值", "缺少交易记录", "缺少图片"]);
});

test("组合质量清单识别超过 360 天的估值并按优先级排序", () => {
  const result = buildPortfolioQualityCards([
    record({
      id: "stale",
      playerName: "Player B",
      valuations: [{
        amountMinor: BigInt(10000),
        currency: "CNY",
        valuedAt: new Date("2025-01-01T00:00:00.000Z"),
        createdAt: new Date("2025-01-01T00:00:00.000Z"),
        source: "manual"
      }]
    }),
    record({ id: "missing", valuations: [] })
  ], new Date("2026-08-25T00:00:00.000Z"));

  assert.equal(result[0].id, "missing");
  assert.equal(result[1].id, "stale");
  assert.deepEqual(result[1].issues, ["估值超过 360 天"]);
});

test("组合质量清单处理所有传入的收藏卡片", () => {
  const result = buildPortfolioQualityCards([
    record({ id: "sold", valuations: [], transactionCount: 0, imageCount: 0 }),
    record({ id: "target", valuations: [], transactionCount: 0, imageCount: 0 }),
    record({ id: "holding", valuations: [], transactionCount: 0, imageCount: 0 })
  ], new Date("2026-08-25T00:00:00.000Z"));

  assert.deepEqual(result.map((card) => card.id).sort(), ["holding", "sold", "target"]);
});

test("组合质量清单以 360 天为估值过期边界", () => {
  const asOf = new Date("2026-08-25T00:00:00.000Z");
  const valuation = (daysAgo: number) => [{
    amountMinor: BigInt(10000),
    currency: "CNY",
    valuedAt: new Date(asOf.getTime() - daysAgo * 86_400_000),
    createdAt: new Date(asOf.getTime() - daysAgo * 86_400_000),
    source: "manual"
  }];

  assert.deepEqual(buildPortfolioQualityCards([record({ valuations: valuation(360) })], asOf), []);
  assert.deepEqual(
    buildPortfolioQualityCards([record({ valuations: valuation(361) })], asOf)[0].issues,
    ["估值超过 360 天"]
  );
});
