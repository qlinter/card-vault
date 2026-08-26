import assert from "node:assert/strict";
import test from "node:test";
import { formatPercentage } from "../lib/percentage-format.ts";
import {
  formatPortfolioCountPercent,
  formatPortfolioMoney,
  formatSignedPortfolioMoney
} from "../lib/portfolio-presentation.ts";

test("组合百分比默认最多保留两位小数", () => {
  assert.equal(formatPercentage(12), "12%");
  assert.equal(formatPercentage(12.3), "12.3%");
  assert.equal(formatPercentage(12.345), "12.35%");
  assert.equal(formatPercentage(33.330000000000005), "33.33%");
});

test("组合百分比可保留既有的一位或两位显示精度", () => {
  assert.equal(formatPercentage(12.34, { fractionDigits: 1 }), "12.3%");
  assert.equal(formatPercentage(12.3, { fractionDigits: 2 }), "12.30%");
  assert.equal(formatPercentage(-7.125, { fractionDigits: 2, signed: true }), "−7.13%");
  assert.equal(formatPercentage(null), "—");
});

test("组合金额与覆盖率共用统一展示格式", () => {
  assert.equal(formatPortfolioMoney(1234.5, "CNY"), "CNY 1,234.50");
  assert.equal(formatSignedPortfolioMoney(25.5, "USD"), "USD +25.50");
  assert.equal(formatSignedPortfolioMoney(-25.5, "USD"), "USD −25.50");
  assert.equal(formatPortfolioCountPercent(1, 3), "33%");
  assert.equal(formatPortfolioCountPercent(0, 0, "--"), "--");
});
