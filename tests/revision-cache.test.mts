import assert from "node:assert/strict";
import test from "node:test";
import { createRevisionCache } from "../lib/revision-cache.ts";
import { createPortfolioCacheBoundary } from "../lib/portfolio-cache-boundary.ts";
import type { PortfolioCardRecord } from "../lib/portfolio-analysis-types.ts";

test("calculation reuse coalesces a revision and invalidates on writes, expiry and clock rollback", async () => {
  let now = 1000, calls = 0;
  const cache = createRevisionCache<number>({ now: () => now });
  const load = async () => ({ value: ++calls, createdAt: now, expiresAt: now + 1000, weight: 1 });
  assert.deepEqual(await Promise.all([cache.get("scope", "1", load), cache.get("scope", "1", load)]), [1, 1]);
  assert.equal(await cache.get("scope", "2", load), 2);
  now = 2000; assert.equal(await cache.get("scope", "2", load), 3);
  now = 100; assert.equal(await cache.get("scope", "2", load), 4);
});

test("cache capacity is bounded, failed work is retryable and oversized entries are not retained", async () => {
  const cache = createRevisionCache<number>({ maxEntries: 1, maxBytes: 10, now: () => 1 });
  const entry = (value: number, weight = 1) => async () => ({ value, weight, createdAt: 0, expiresAt: 100 });
  await cache.get("a", "1", entry(1)); await cache.get("b", "1", entry(2));
  assert.equal(cache.stats().entries, 1);
  await cache.get("huge", "1", entry(3, 11)); assert.equal(cache.stats().bytes, 1);
  await assert.rejects(cache.get("fail", "1", async () => { throw new Error("temporary"); }), /temporary/);
  assert.equal(await cache.get("fail", "1", entry(4)), 4);
  cache.clear(); assert.equal(cache.stats().entries, 0);
});

test("future business records, rolling windows, valuation ageing and UTC day boundaries cap reuse", () => {
  const at = new Date("2026-10-24T10:00:00Z");
  const card: PortfolioCardRecord = { playerName: "N", sport: "Basketball", collectionStatus: "holding", gradingCompany: null, grade: null, isRookie: false, isAutograph: false, isPatch: false,
    transactions: [{ kind: "purchase", currency: "CNY", amountMinor: 1n, occurredAt: new Date(at.getTime() + 100) }], expenses: [], valuations: [] };
  const future = createPortfolioCacheBoundary(at); future.add([card]); assert.equal(future.expiresAt(), at.getTime() + 100);
  const created = createPortfolioCacheBoundary(at); created.add([{ ...card, transactions: [], createdAt: new Date(at.getTime() + 50) }]); assert.equal(created.expiresAt(), at.getTime() + 50);
  const midnight = createPortfolioCacheBoundary(new Date("2026-10-24T23:59:59Z")); assert.equal(midnight.expiresAt(), Date.parse("2026-10-25T00:00:00Z"));
  const ageing = createPortfolioCacheBoundary(at);
  ageing.add([{ ...card, transactions: [], valuations: [{ amountMinor: 1n, currency: "CNY", source: "test", createdAt: at, valuedAt: new Date(at.getTime() - 180 * 86400000) }] }]);
  assert.equal(ageing.expiresAt(), at.getTime() + 1);
});
