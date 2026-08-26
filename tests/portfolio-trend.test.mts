import assert from "node:assert/strict";
import test from "node:test";
import { portfolioTrendLabelIndexes, portfolioTrendMonths } from "../lib/portfolio-trend.ts";
import type { PortfolioSnapshot } from "../lib/portfolio-analysis-types.ts";

function timeSeries(): PortfolioSnapshot["timeSeries"] {
  return {
    purchases: [{ month: "2023-01", count: 1, values: { CNY: 100 } }],
    sales: [{ month: "2026-03", count: 1, values: { CNY: 200 } }],
    expenses: [],
    valuations: [{ month: "2025-08", count: 1, values: { USD: 10 } }]
  };
}

test("活动趋势近 12 和 24 个月生成连续月份坐标", () => {
  const twelveMonths = portfolioTrendMonths(timeSeries(), 12, "2026-03");
  const twentyFourMonths = portfolioTrendMonths(timeSeries(), 24, "2026-03");

  assert.equal(twelveMonths.length, 12);
  assert.equal(twelveMonths[0], "2025-04");
  assert.equal(twelveMonths.at(-1), "2026-03");
  assert.equal(twentyFourMonths.length, 24);
  assert.equal(twentyFourMonths[0], "2024-04");
});

test("活动趋势所有范围覆盖最早至最晚记录并填充空月份", () => {
  const months = portfolioTrendMonths(timeSeries(), "all", "2026-03");
  assert.equal(months[0], "2023-01");
  assert.equal(months.at(-1), "2026-03");
  assert.ok(months.includes("2024-06"));
});

test("活动趋势时间范围以当前月份为终点而不是停在最后一次活动", () => {
  const months = portfolioTrendMonths(timeSeries(), 12, "2026-08");
  assert.equal(months[0], "2025-09");
  assert.equal(months.at(-1), "2026-08");
});

test("活动趋势在没有记录时保持空状态", () => {
  assert.deepEqual(portfolioTrendMonths({ purchases: [], sales: [], expenses: [], valuations: [] }, 12), []);
});

test("活动趋势月份标签按宽度间隔显示并保留首尾", () => {
  const indexes = portfolioTrendLabelIndexes(12, 600);
  assert.deepEqual(indexes, [0, 2, 4, 6, 8, 11]);
  assert.equal(indexes[0], 0);
  assert.equal(indexes.at(-1), 11);
});
