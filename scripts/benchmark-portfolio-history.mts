import assert from "node:assert/strict";
import fs from "node:fs";
import { performance } from "node:perf_hooks";
import { denseHistoryCards } from "../tests/fixtures/dense-portfolio.ts";
import { buildPortfolioFinancialHistory } from "../lib/portfolio-insights.ts";
import { buildPortfolioFinancialHistory as reference } from "../tests/fixtures/portfolio-history-reference.ts";
const now = new Date("2026-09-09T12:00:00Z");
const cards = denseHistoryCards(500, 240);
assert.deepEqual(buildPortfolioFinancialHistory(cards, now), reference(cards, now));
function timed(fn: typeof reference) { const start = performance.now(); fn(cards, now); return performance.now() - start; }
timed(reference); timed(buildPortfolioFinancialHistory);
const before: number[] = [], after: number[] = [];
for (let n=0;n<5;n++) { if(n%2){after.push(timed(buildPortfolioFinancialHistory));before.push(timed(reference));}else{before.push(timed(reference));after.push(timed(buildPortfolioFinancialHistory));} }
const median = (values:number[]) => [...values].sort((a,b)=>a-b)[2];
const result = { node:process.version, cards:500, valuationsPerCard:240, rounds:5, identical:true, beforeMedianMs:median(before), afterMedianMs:median(after), before, after };
fs.mkdirSync('logs',{recursive:true});fs.writeFileSync('logs/v132-portfolio-history-benchmark.json',JSON.stringify(result,null,2));console.log(result);
