import assert from "node:assert/strict";
import test from "node:test";
import { deriveCollectionTasks, taskIsVisible, type TaskCard } from "../lib/collection-tasks.ts";
const now = new Date("2026-09-07T00:00:00Z");
const card: TaskCard = { id: "one", playerName: "卡片主体", cardTitle: "备注", collectionStatus: "holding", createdAt: new Date("2025-01-01"), updatedAt: new Date("2026-01-01"), _count: { images: 0, transactions: 0 }, valuations: [] };
const tracking = { statusStartedAt: new Date("2025-01-01"), statusDateEstimated: false, statusRevision: 0, imagesRevision: 0, purchaseRevision: 0, valuationRevision: 0 };

test("unrelated edits do not postpone status follow-up; recurring missing evidence reopens", () => {
  const listed = deriveCollectionTasks([{ ...card, collectionStatus: "listed", updatedAt: now, tracking }], now).find(task => task.kind === "listed");
  assert.ok(listed);
  assert.equal(listed.dateEstimated, false);
  const initial = deriveCollectionTasks([{ ...card, tracking }], now).find(task => task.kind === "images")!;
  const completed = { status: "done", fingerprint: initial.fingerprint, snoozedUntil: null };
  const recurring = deriveCollectionTasks([{ ...card, tracking: { ...tracking, imagesRevision: 2 } }], now).find(task => task.kind === "images")!;
  assert.equal(taskIsVisible(initial, completed), false);
  assert.equal(taskIsVisible(recurring, completed), true);
  assert.ok(deriveCollectionTasks([{ ...card, _count: { images: 1, transactions: 1 }, hasUnknownPurchase: true }], now).some(task => task.kind === "purchase"));
});
test("reminder rules handle missing history, stale valuations and sold holdings", () => {
  assert.deepEqual(new Set(deriveCollectionTasks([card], now).map(task => task.kind)), new Set(["images", "purchase", "valuation"]));
  assert.ok(deriveCollectionTasks([{ ...card, collectionStatus: "grading", valuations: [{ valuedAt: new Date("2025-01-01") }] }], now).some(task => task.kind === "stale"));
  assert.deepEqual(deriveCollectionTasks([{ ...card, collectionStatus: "sold", _count: { images: 1, transactions: 1 } }], now), []);
  assert.ok(deriveCollectionTasks([{ ...card, collectionStatus: "listed" }], now).some(task => task.kind === "listed"));
});
test("dismissal stays stable, snooze expires, changed evidence reopens the task", () => {
  const task = deriveCollectionTasks([card], now)[0];
  const state = { fingerprint: task.fingerprint, status: "done", snoozedUntil: null };
  assert.equal(taskIsVisible(task, state, now), false);
  assert.equal(taskIsVisible(task, { ...state, fingerprint: "previous" }, now), true);
  assert.equal(taskIsVisible(task, { ...state, status: "snoozed", snoozedUntil: new Date("2026-09-08") }, now), false);
  assert.equal(taskIsVisible(task, { ...state, status: "snoozed", snoozedUntil: now }, now), true);
});

test("valuation, grading and listing reminders share the 180-day boundary", () => {
  for (const days of [60, 90, 179, 180, 181]) {
    const date = new Date(now.getTime() - days * 86400000);
    for (const status of ["grading", "listed"]) {
      const tasks = deriveCollectionTasks([{ ...card, collectionStatus: status, updatedAt: date, _count: { images: 1, transactions: 1 }, valuations: [{ valuedAt: date }] }], now);
      assert.deepEqual(new Set(tasks.map(task => task.kind)), new Set(days >= 180 ? ["stale", status] : []), status + " at " + days + " days");
    }
  }
});
