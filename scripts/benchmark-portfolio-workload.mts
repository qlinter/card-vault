import assert from "node:assert/strict";
import fs from "node:fs";
import { createPortfolioBatchAccumulator } from "../lib/portfolio-batch.ts";
import { createPortfolioBatchAccumulator as reference } from "../tests/fixtures/portfolio-batch-reference.ts";
import { denseHistoryCards } from "../tests/fixtures/dense-portfolio.ts";

const cards = denseHistoryCards(2000, 120);
const scope = { isFiltered: false, criteria: [] };
const config = { reportingCurrency: "CNY", rates: [{ id: "rate", effectiveDate: "2000-01-01", rateMicros: 7123456n, revision: 1, source: "benchmark" }] };
const at = new Date("2026-10-12T08:00:00Z");
function run(mode: "reference" | "full" | "summary") {
  const start = performance.now();
  const accumulator = mode === "reference" ? reference(scope, config, at, "2016-01")
    : createPortfolioBatchAccumulator(scope, config, at, "2016-01", { includeDetails: mode === "full" });
  for (let i = 0; i < cards.length; i += 250) accumulator.add(cards.slice(i, i + 250));
  const result = accumulator.finish();
  return { result, ms: Math.round(performance.now() - start) };
}
const expected = run("reference").result;
const timings: Record<string, number[]> = { reference: [], full: [], summary: [] };
for (let round = 0; round < 4; round++) {
  const modes = ["reference", "full", "summary"] as const;
  for (const mode of round % 2 ? [...modes].reverse() : modes) {
    const result = run(mode);
    assert.deepEqual(result.result.snapshot, expected.snapshot);
    if (mode !== "summary") assert.deepEqual(result.result, expected);
    timings[mode].push(result.ms);
  }
}
const median = (values: number[]) => { const sorted = [...values].sort((a, b) => a - b); return (sorted[1] + sorted[2]) / 2; };
const report = { node: process.version, cards: cards.length, valuationsPerCard: 120, scope: "in-memory calculation, excludes database and rendering", identical: true, timings, medianMs: Object.fromEntries(Object.entries(timings).map(([mode, values]) => [mode, median(values)])) };
fs.mkdirSync("logs", { recursive: true });
fs.writeFileSync("logs/portfolio-workload-benchmark.json", JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
