import assert from "node:assert/strict";
import test from "node:test";
import { chooseRepresentatives, createRecapAccumulator, normalizeRecapSpec, recapActivity, recapDefaultTitle, recapPeriod, recapQuery, representativeIds } from "../lib/collection-recap.ts";

test("recap default titles use a readable year/month", () => {
  assert.equal(recapDefaultTitle({ year: 2026, month: 3 }), "2026年3月收藏回顾");
  assert.equal(recapDefaultTitle({ year: 2026 }), "2026年收藏回顾");
  assert.equal(recapDefaultTitle({ year: 2026, month: 3 }, "en"), "March 2026 Collection Recap");
});

test("representatives prioritize subject and month coverage with stable tie order", () => {
  const result = chooseRepresentatives([{ id: "a", playerName: "A", month: 0 }, { id: "a2", playerName: "A", month: 1 }, { id: "b", playerName: "B", month: 0 }, { id: "c", playerName: "C", month: 1 }]);
  assert.deepEqual(result, ["a", "c", "b", "a2"]);
});
import { advancePlayback, changePlaybackOrder, startPlayback } from "../lib/immersive-playback.ts";

const now = new Date("2026-11-05T00:00:00Z");
const card = { id: "a", playerName: "Player A", sport: "Basketball", productLine: "Series", isAutograph: true, grade: "10", createdAt: new Date("2026-03-01T00:00:00Z") };
const purchase = (date: string, quantity = 1) => ({ occurredAt: new Date(date), quantity });

test("monthly activity groups Monday weeks clipped to the month including leap days", () => {
  const period = normalizeRecapSpec({ year: 2024, month: 2 });
  const accumulator = createRecapAccumulator(period, now);
  accumulator.add(card, [purchase("2024-01-31Z", 99), purchase("2024-02-01Z", 2), purchase("2024-02-04Z", 3), purchase("2024-02-05Z", 4), purchase("2024-02-29Z", 6), purchase("2024-03-01Z", 99)]);
  assert.deepEqual(accumulator.finish().weeks, [{ start: 1, end: 4, count: 5 }, { start: 5, end: 11, count: 4 }, { start: 12, end: 18, count: 0 }, { start: 19, end: 25, count: 0 }, { start: 26, end: 29, count: 6 }]);
  assert.equal(accumulator.finish().quantity, 15);
  const entry = createRecapAccumulator(normalizeRecapSpec({ year: 2026, month: 3, basis: "entry" }), now);
  entry.add(card, []);
  assert.equal(entry.finish().weeks.length, 6);
  assert.equal(entry.finish().weeks[0].count, 1);
});

test("recap separates back-entered archives from purchase dates and repeat quantities", () => {
  const events = [purchase("2020-01-02Z", 2), purchase("2026-01-02Z", 3), purchase("2026-03-02Z", 4), purchase("2027-01-01Z", 20)];
  const purchases = createRecapAccumulator(normalizeRecapSpec({ year: 2026 }), now); purchases.add(card, events);
  const result = purchases.finish(2);
  assert.equal(result.quantity, 7); assert.equal(result.cardCount, 1); assert.equal(result.autograph, 1); assert.equal(result.graded, 1);
  assert.deepEqual(result.months.slice(0, 3), [3, 0, 4]); assert.equal(result.missingPurchases, 2); assert.equal(result.inProgress, true);
  const entry = createRecapAccumulator(normalizeRecapSpec({ year: 2026, basis: "entry" }), now); entry.add(card, events);
  assert.equal(entry.finish().quantity, 1); assert.equal(entry.finish().months[2], 1);
  const historical = createRecapAccumulator(normalizeRecapSpec({ year: 2020 }), now); historical.add(card, events); assert.equal(historical.finish().quantity, 2);
  const missing = createRecapAccumulator(normalizeRecapSpec({ year: 2026 }), now); missing.add(card, []); assert.equal(missing.finish().cardCount, 0);
});

test("recap bounds handle month/year boundaries and exclude future records", () => {
  const spec = normalizeRecapSpec({ year: 2026, month: 12 });
  assert.equal(recapPeriod(spec, new Date("2027-01-03Z")).end.toISOString(), "2027-01-01T00:00:00.000Z");
  assert.equal(recapActivity(spec, { createdAt: card.createdAt, transactions: [purchase("2026-12-01Z"), purchase("2027-01-01Z")] }, new Date("2027-01-03Z")).length, 1);
  assert.equal(recapActivity(normalizeRecapSpec({ year: 2026 }), { createdAt: card.createdAt, transactions: [purchase("2026-11-06Z")] }, now).length, 0);
  assert.throws(() => normalizeRecapSpec({ month: 13 })); assert.throws(() => normalizeRecapSpec({ year: "bad" })); assert.throws(() => normalizeRecapSpec({ basis: "guessed" }));
});

test("recap scope preserves card year independently of recap year and validates representatives", () => {
  const spec = normalizeRecapSpec({ year: 2026, scope: { year: "2020", sport: "Basketball", unknown: "discard" } });
  const query = new URLSearchParams(recapQuery(spec));
  assert.equal(query.get("recapYear"), "2026"); assert.equal(query.get("year"), "2020"); assert.equal(query.has("unknown"), false);
  assert.throws(() => representativeIds(["a", "a"])); assert.throws(() => representativeIds(Array.from({ length: 7 }, (_, i) => String(i))));
  const acc = createRecapAccumulator(normalizeRecapSpec({ year: 2026, basis: "entry" }), now);
  for (let i = 0; i < 200; i++) acc.add({ ...card, id: String(i), playerName: `Player ${i % 10}`, createdAt: new Date(Date.UTC(2026, i % 10, 2)) }, []);
  const result = acc.finish(); assert.equal(result.representatives.length, 6); assert.equal(new Set(result.representatives).size, 6); assert.equal(result.subjectCount, 10);
  const sameSubject = createRecapAccumulator(normalizeRecapSpec({ year: 2026, basis: "entry" }), now);
  for (let i = 0; i < 8; i++) sameSubject.add({ ...card, id: String(i) }, []);
  assert.equal(sameSubject.finish().representatives.length, 6);
});

test("random playback has no repeats per round and backward follows actual history", () => {
  let state = startPlayback(["a", "b", "c", "d"], true, () => .3);
  const visits = [state.history[0]];
  for (let i = 0; i < 3; i++) { state = advancePlayback(state, 1, () => .3); visits.push(state.history[state.index]); }
  assert.equal(new Set(visits).size, 4);
  state = advancePlayback(state, -1); assert.equal(state.history[state.index], visits[2]);
  state = advancePlayback(state, 1); assert.equal(state.history[state.index], visits[3]);
  state = advancePlayback(state, 1, () => .3); assert.equal(state.round, 2); assert.notEqual(state.history[state.index], visits[3]);
  const changed = changePlaybackOrder(state, false); assert.deepEqual(changed.history, state.history);
  assert.deepEqual(startPlayback([]).history, []); assert.deepEqual(advancePlayback(startPlayback([]), 1).ids, []);
  let single = startPlayback(["a", "a"]); single = advancePlayback(single, 1); assert.equal(single.history[single.index], "a");
});
