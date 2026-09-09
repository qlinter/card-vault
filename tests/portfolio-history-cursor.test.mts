import assert from "node:assert/strict";
import test from "node:test";
import { buildPortfolioFinancialHistory } from "../lib/portfolio-insights.ts";
import { buildPortfolioFinancialHistory as reference } from "./fixtures/portfolio-history-reference.ts";
import { reportingHistory } from "../lib/financial-reporting.ts";

const asOf = new Date("2026-09-09T12:00:00Z");

import { denseHistoryCards } from "./fixtures/dense-portfolio.ts";

test("chronological portfolio history exactly matches all former monthly amounts, coverage and missing markers", () => {
  const cards = denseHistoryCards();
  const original = structuredClone(cards);
  assert.deepEqual(buildPortfolioFinancialHistory(cards, asOf), reference(cards, asOf));
  for (const reportingCurrency of ["CNY", "USD"]) {
    for (const rates of [[], [{ id:"fx", effectiveDate:"2024-01-01", rateMicros:7100000n, source:"manual", revision:1 }]]) {
      const projected = cards.map(card => reportingHistory(card, { reportingCurrency, rates }, asOf));
      assert.deepEqual(buildPortfolioFinancialHistory(projected, asOf), reference(projected, asOf));
    }
  }
  assert.deepEqual(cards, original);
  assert.deepEqual(buildPortfolioFinancialHistory([], asOf), []);
});
