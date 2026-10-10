import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { PrismaClient } from "@prisma/client";
import databaseSchema from "./database-schema.js";
import { portfolioAnalysisCardSelect } from "../lib/card-query-shapes.ts";
import { buildReportingPortfolio } from "../lib/portfolio-reporting.ts";
import { createPortfolioBatchAccumulator } from "../lib/portfolio-batch.ts";
import { buildPortfolioFinancialHistory, buildPortfolioPositionReviews, buildPortfolioValuationChanges } from "../lib/portfolio-insights.ts";
import { buildPortfolioQualityCards } from "../lib/portfolio-quality.ts";

const root = fs.mkdtempSync(path.join(os.tmpdir(), "card-vault-batch-benchmark-"));
const dbPath = path.join(root, "dev.db");
databaseSchema.initializeDatabase(dbPath);
const db = new DatabaseSync(dbPath);
const insert = db.prepare("INSERT INTO Card(id,playerName,cardTitle,sport,holdingQuantity) VALUES(?,'Benchmark',?,'Basketball',1)");
const buy = db.prepare("INSERT INTO CardTransaction(id,cardId,kind,amountMinor,currency,quantity,occurredAt,provenance) VALUES(?,?,'purchase',20001,'CNY',1,'2024-01-01T00:00:00.000Z','benchmark')");
const quote = db.prepare("INSERT INTO CardValuation(id,cardId,amountMinor,currency,valuedAt,source,provenance) VALUES(?,?,21001,'CNY',?,'个人估计','benchmark')");
db.exec("BEGIN");
for (let index = 0; index < 10000; index++) {
  const id = String(index).padStart(5, "0"); insert.run(id, `Card ${id}`); buy.run(`${id}-buy`, id);
  for (let month = 0; month < 36; month++) quote.run(`${id}-${month}`, id, new Date(Date.UTC(2024, month, 1)).toISOString());
}
db.exec("COMMIT"); db.close();
const prisma = new PrismaClient({ datasources: { db: { url: `file:${dbPath.replaceAll("\\", "/")}` } } });
const asOf = new Date("2026-10-10T08:00:00Z"), scope = { isFiltered: false, criteria: [] }, config = { reportingCurrency: "CNY", rates: [] };
async function run(batched: boolean) {
  global.gc?.();
  const start = performance.now();
  const accumulator = createPortfolioBatchAccumulator(scope, config, asOf, "2024-01");
  const cards: Array<Parameters<typeof buildReportingPortfolio>[0][number]> = [];
  let cursor: string | undefined, queryMs = 0, computeMs = 0, peakHeap = 0;
  const sample = () => { peakHeap = Math.max(peakHeap, process.memoryUsage().heapUsed); };
  for (;;) {
    const beforeQuery = performance.now();
    const page = await prisma.card.findMany({ select: portfolioAnalysisCardSelect, take: 250, orderBy: { id: "asc" }, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}) });
    queryMs += performance.now() - beforeQuery;
    const beforeCompute = performance.now();
    const records = page.map(card => ({ ...card, imageCount: card._count.images }));
    if (batched) accumulator.add(records); else cards.push(...records);
    computeMs += performance.now() - beforeCompute; sample();
    if (page.length < 250) break; cursor = page.at(-1)!.id;
  }
  const beforeFinish = performance.now();
  let result;
  if (batched) result = accumulator.finish();
  else {
    const reporting = buildReportingPortfolio(cards, scope, config, asOf);
    sample();
    result = { snapshot: reporting.snapshot, incompleteCards: reporting.incompleteCards,
      qualityCards: buildPortfolioQualityCards(cards.map(card => ({ id: card.id!, playerName: card.playerName, cardTitle: card.cardTitle ?? "", sport: card.sport, imageCount: card.imageCount ?? 0, transactionCount: card.transactions.length, valuations: card.valuations })), asOf),
      financialHistory: buildPortfolioFinancialHistory(reporting.cards, asOf), valuationChanges: buildPortfolioValuationChanges(reporting.cards, asOf), ...buildPortfolioPositionReviews(reporting.cards) };
  }
  computeMs += performance.now() - beforeFinish; sample();
  return { result, measurement: { batched, queryMs: Math.round(queryMs), computeMs: Math.round(computeMs), totalMs: Math.round(performance.now() - start), peakHeapMb: Math.round(peakHeap / 1048576) } };
}
try {
  const measurements = [];
  // Alternate order on one database and connection to limit machine-load and warm-cache bias.
  for (let round = 0; round < 4; round++) {
    const first = await run(round % 2 === 0), second = await run(round % 2 !== 0);
    assert.deepEqual(first.result, second.result);
    measurements.push(first.measurement, second.measurement);
    process.stdout.write(JSON.stringify({ round, first: first.measurement, second: second.measurement, identical: true }) + "\n");
  }
  const median = (values: number[]) => { const sorted = [...values].sort((a, b) => a - b); return (sorted[1] + sorted[2]) / 2; };
  const summary = [false, true].map(batched => ({ batched, totalMs: median(measurements.filter(row => row.batched === batched).map(row => row.totalMs)), peakHeapMb: median(measurements.filter(row => row.batched === batched).map(row => row.peakHeapMb)) }));
  const version = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;
  const destination = path.resolve("logs", `v${version}-review`, "batch-comparison.json");
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, JSON.stringify({ node: process.version, cards: 10000, quotes: 360000, measurements, summary }, null, 2));
  process.stdout.write(JSON.stringify({ summary }) + "\n");
} finally { await prisma.$disconnect(); fs.rmSync(root, { recursive: true, force: true }); }
