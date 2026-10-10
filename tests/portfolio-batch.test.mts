import assert from "node:assert/strict";
import test from "node:test";
import { createPortfolioBatchAccumulator } from "../lib/portfolio-batch.ts";
import { buildReportingPortfolio } from "../lib/portfolio-reporting.ts";
import { buildPortfolioFinancialHistory, buildPortfolioPositionReviews, buildPortfolioValuationChanges } from "../lib/portfolio-insights.ts";
import { buildPortfolioQualityCards } from "../lib/portfolio-quality.ts";
import { denseHistoryCards } from "./fixtures/dense-portfolio.ts";
import type { PortfolioCardRecord } from "../lib/portfolio-analysis-types.ts";

const scope = { isFiltered: true, criteria: [] };
const asOf = new Date("2026-10-10T08:00:00Z");
const config = { reportingCurrency: "CNY", rates: [{ id: "rate", effectiveDate: "2023-04-01", rateMicros: 7123456n, revision: 1, source: "test" }] };

function expected(cards: PortfolioCardRecord[]) {
  const reporting = buildReportingPortfolio(cards, scope, config, asOf);
  return { snapshot: reporting.snapshot, incompleteCards: reporting.incompleteCards,
    qualityCards: buildPortfolioQualityCards(cards.map(card => ({ id: card.id!, playerName: card.playerName, cardTitle: card.cardTitle ?? "", sport: card.sport, imageCount: card.imageCount ?? 0, transactionCount: card.transactions.length, valuations: card.valuations })), asOf),
    valuationChanges: buildPortfolioValuationChanges(reporting.cards, asOf), financialHistory: buildPortfolioFinancialHistory(reporting.cards, asOf), ...buildPortfolioPositionReviews(reporting.cards) };
}

test("batch aggregation preserves complete dense mixed-currency output across batch boundaries", () => {
  const cards = denseHistoryCards(47, 60).map((card, index) => ({ ...card, playerName: `Player ${index % 23}`, cardTitle: index % 9 ? `Card ${index}` : "", sport: `Sport ${index % 13}`, team: `Team ${index % 5}`, imageCount: index % 3, publicDescription: index % 4 ? "story" : null, isAutograph: index % 3 === 0, autoType: "on-card", isPatch: index % 4 === 0, patchType: "jersey" }));
  const reference = expected(cards);
  for (const size of [1, 7, 250]) {
    const accumulator = createPortfolioBatchAccumulator(scope, config, asOf, "2022-12");
    for (let index = 0; index < cards.length; index += size) accumulator.add(cards.slice(index, index + size));
    assert.deepEqual(accumulator.finish(), reference, `batch size ${size}`);
  }
});

test("unquoted batches do not erase partial historical value and no-history holdings contribute to coverage", () => {
  const template = denseHistoryCards(1, 0)[0];
  const cards: PortfolioCardRecord[] = [
    { ...template, id: "quoted", collectionStatus: "holding", holdingQuantity: 1, createdAt: new Date("2024-01-01"), transactions: [{ kind: "purchase", quantity: 1, currency: "CNY", amountMinor: 100n, occurredAt: new Date("2024-01-01") }], expenses: [], valuations: [{ currency: "CNY", amountMinor: 200n, valuedAt: new Date("2024-03-01"), createdAt: new Date("2024-03-01"), source: "个人估计" }] },
    { ...template, id: "no-records", collectionStatus: "holding", holdingQuantity: 2, createdAt: new Date("2024-01-01"), transactions: [], expenses: [], valuations: [] },
    { ...template, id: "later", collectionStatus: "holding", createdAt: new Date("2025-01-01"), transactions: [{ kind: "purchase", currency: "CNY", amountMinor: 1000n, occurredAt: new Date("2025-01-01") }], expenses: [], valuations: [] }
  ];
  const accumulator = createPortfolioBatchAccumulator(scope, config, asOf, "2024-01");
  for (const card of cards) accumulator.add([card]);
  assert.deepEqual(accumulator.finish(), expected(cards));
});

test("empty filtered collections retain the existing empty snapshot and no history", () => {
  const accumulator = createPortfolioBatchAccumulator(scope, config, asOf, "2020-01");
  accumulator.add([]);
  assert.deepEqual(accumulator.finish(), expected([]));
});
