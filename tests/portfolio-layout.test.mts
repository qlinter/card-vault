import assert from "node:assert/strict";
import test from "node:test";
import {
  defaultPortfolioLayout,
  movePortfolioSection,
  normalizePortfolioLayout,
  reorderPortfolioSections
} from "../lib/portfolio-layout.ts";

test("组合布局补齐新增栏目并丢弃未知或重复标识", () => {
  const layout = normalizePortfolioLayout({
    full: ["activity-trend", "unknown", "activity-trend", "financial-position"],
    half: ["sold-review", "high-value"]
  });
  assert.deepEqual(layout.full.slice(0, 2), ["activity-trend", "financial-position"]);
  assert.equal(new Set(layout.full).size, defaultPortfolioLayout().full.length);
  assert.deepEqual(layout.half, ["sold-review", "high-value", "data-quality", "high-cost"]);
});

test("组合栏目支持键盘相邻移动并保护边界", () => {
  assert.deepEqual(movePortfolioSection(["a", "b", "c"], "b", -1), ["b", "a", "c"]);
  assert.deepEqual(movePortfolioSection(["a", "b", "c"], "b", 1), ["a", "c", "b"]);
  assert.deepEqual(movePortfolioSection(["a", "b"], "a", -1), ["a", "b"]);
});

test("组合栏目拖拽顺序移动到目标位置", () => {
  assert.deepEqual(reorderPortfolioSections(["a", "b", "c", "d"], "d", "b"), ["a", "d", "b", "c"]);
  assert.deepEqual(reorderPortfolioSections(["a", "b", "c", "d"], "a", "d", "after"), ["b", "c", "d", "a"]);
  assert.deepEqual(reorderPortfolioSections(["a", "b"], "a", "a"), ["a", "b"]);
});
