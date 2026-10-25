import assert from "node:assert/strict";
import test from "node:test";
import { createDataCollector } from "../lib/portfolio-workspace.ts";
import { selectDataRows } from "../lib/portfolio-data-rows.ts";
import { dataHref, dataGroupCount, profitTone, valuationChangeAvailable, attributeDrillQuery } from "../lib/portfolio-navigation.ts";
import { cardAttributeFields } from "../lib/portfolio-workspace-types.ts";
import { createPortfolioBatchAccumulator } from "../lib/portfolio-batch.ts";
import type { PortfolioCardRecord } from "../lib/portfolio-analysis-types.ts";
import { normalizePortfolioWorkspaceState } from "../lib/portfolio-workspace-state.ts";
import { createDataRowSelector } from "../lib/portfolio-data-rows.ts";

const asOf = new Date("2026-10-23T00:00:00Z");
test("a reusable detail selector preserves complete pagination and search/sort independence", () => {
  const all = Array.from({ length: 63 }, (_, index) => ({ ...card(`index-${index}`), playerName: index % 2 ? "A" : "B" }));
  const collector = createDataCollector(asOf);
  const accumulator = createPortfolioBatchAccumulator({ isFiltered: false, criteria: [] }, { reportingCurrency: "CNY", rates: [] }, asOf, undefined, { includeDetails: false, onReportingBatch: collector.add });
  accumulator.add(all); accumulator.finish();
  const rows = collector.finishAll().rows, select = createDataRowSelector(rows);
  for (const params of [{ kind: "all", page: "1" }, { kind: "all", page: "4" }, { search: "A", order: "nameAsc", page: "2" }, { order: "costDesc", page: "999" }]) assert.deepEqual(select(params), selectDataRows(rows, params));
});
test("attribute drill-down never replaces a conflicting inherited filter", () => {
  for (const field of cardAttributeFields) {
    assert.equal(attributeDrillQuery({ sport: "Basketball", [field]: "false" }, field), null);
    assert.deepEqual(attributeDrillQuery({ sport: "Basketball", [field]: "true" }, field), { sport: "Basketball", [field]: "true" });
    assert.deepEqual(attributeDrillQuery({ wish: "scope" }, field), { wish: "scope", [field]: "true" });
  }
});

test("one detail list filters holdings, partial sales and archive statuses without changing row values", () => {
  const held = card("unified-held");
  const partial = { ...card("unified-partial"), holdingQuantity: 1 };
  partial.transactions.push({ kind: "sale", quantity: 1, amountMinor: 7500n, currency: "CNY", occurredAt: asOf });
  const sold = { ...card("unified-sold"), collectionStatus: "sold", holdingQuantity: 0 };
  sold.transactions.push({ kind: "sale", quantity: 2, amountMinor: 15000n, currency: "CNY", occurredAt: asOf });
  const listed = { ...card("unified-listed"), collectionStatus: "listed" };
  const rows = collect([held, partial, sold, listed]).rows;
  const select = createDataRowSelector(rows);
  const ids = (params: Record<string, string>) => new Set(select(params).rows.map(row => row.id));
  assert.equal(select({}).total, 4);
  assert.equal(select({ kind: "holdings" }).total, 3);
  assert.deepEqual(ids({ kind: "all", detailStatus: "holdings" }), new Set([held.id, partial.id, listed.id]));
  assert.deepEqual(ids({ kind: "all", detailStatus: "sales" }), new Set([partial.id, sold.id]));
  assert.deepEqual(ids({ kind: "all", detailStatus: "listed" }), new Set([listed.id]));
  assert.deepEqual(ids({ kind: "all", detailStatus: "sold" }), new Set([sold.id]));
  assert.deepEqual(ids({ kind: "sold" }), new Set([partial.id, sold.id]));
  assert.deepEqual(select({ detailStatus: "sales" }).rows.find(row => row.id === partial.id), rows.find(row => row.id === partial.id));
});

test("Review lists every issue in the inherited scope and ignores retired list controls", () => {
  const row = collect([card("review-base")]).rows[0];
  const rows = Array.from({ length: 53 }, (_, index) => ({ ...row, id: `review-${index}`, issues: [{ key: "missing_image", label: "无图片", financial: false }] }));
  const select = createDataRowSelector([...rows, row]);
  const result = select({ kind: "quality", search: "no match", issue: "missing_cost", detailStatus: "sold", dimension: "team", item: "not this team", closed: "1", page: "999" });
  assert.equal(result.total, 53);
  assert.equal(result.rows.length, 53);
  assert.equal(result.page, 1); assert.equal(result.pages, 1);
  assert.equal(result.rows.some(item => item.id === "review-base"), false);
  assert.deepEqual(select({ kind: "quality" }), result);
});
function card(id: string, quantity = 2): PortfolioCardRecord {
  return { id, playerName: "Same subject", cardTitle: "Same title", sport: "Basketball", team: "A&B / 队", collectionStatus: "holding", holdingQuantity: quantity, gradingCompany: null, grade: null, isRookie: false, isAutograph: false, isPatch: false, imageCount: 1,
    transactions: [{ kind: "purchase", quantity, amountMinor: 10000n, currency: "CNY", occurredAt: new Date("2026-01-01") }], expenses: [], valuations: [{ amountMinor: 8000n, currency: "CNY", valuedAt: new Date("2026-10-01"), createdAt: new Date("2026-10-01"), source: "个人估值" }] };
}
function collect(cards: PortfolioCardRecord[], includeRows = true) {
  const collector = createDataCollector(asOf, { includeRows });
  const plain = createPortfolioBatchAccumulator({ isFiltered: false, criteria: [] }, { reportingCurrency: "CNY", rates: [] }, asOf, undefined, { includeDetails: false });
  const enhanced = createPortfolioBatchAccumulator({ isFiltered: false, criteria: [] }, { reportingCurrency: "CNY", rates: [] }, asOf, undefined, { includeDetails: false, onReportingBatch: collector.add });
  for (const item of cards) { plain.add([item]); enhanced.add([item]); }
  assert.deepEqual(enhanced.finish(), plain.finish(), "UI collection must preserve the entire financial result");
  return collector.finish({ kind: "all" });
}
test("data rows retain exact IDs, physical quantity, cost and value without changing financial output", () => {
  const workspace = collect([card("copy-a"), card("copy-b", 3)]);
  assert.equal(workspace.quantity, 5);
  assert.equal(workspace.total, 2);
  assert.equal(workspace.physical.team["A&B / 队"], 5);
  assert.deepEqual(workspace.top.map(row => [row.id, row.value, row.cost]), [["copy-b", 240, 100], ["copy-a", 160, 100]]);
});
test("unknown costs and quotes stay missing, and unquoted closed archives need no current quote", () => {
  const unknown = { ...card("unknown"), valuations: [], transactions: [{ ...card("unknown").transactions[0], amountKnown: false }] };
  const sold = { ...card("sold"), collectionStatus: "sold", holdingQuantity: 0, valuations: [], transactions: [...card("sold").transactions, { kind: "sale", quantity: 2, amountMinor: 15000n, currency: "CNY", occurredAt: new Date("2026-10-01") }] };
  const workspace = collect([unknown, sold]);
  const row = workspace.rows.find(row => row.id === "unknown")!;
  assert.equal(row.value, null); assert.equal(row.cost, null);
  assert.ok(row.issues.some(issue => issue.key === "missing_cost"));
  assert.ok(row.issues.some(issue => issue.key === "missing_valuation"));
  const closed = workspace.rows.find(row => row.id === "sold")!;
  assert.equal(closed.quantity, 0); assert.equal(closed.realized, 50);
  assert.ok(!closed.issues.some(issue => issue.key === "missing_valuation"));
});
test("detail filters, Unicode search, stable sort and pagination cover the whole scope", () => {
  const workspace = collect(Array.from({ length: 45 }, (_, index) => ({ ...card(`row-${String(index).padStart(2, "0")}`), playerName: index % 2 ? "Alpha" : "中文球员" })));
  const rows = [...workspace.rows];
  // Build a complete lightweight input from separate pages, rather than sampling only the first page.
  assert.equal(workspace.total, 45);
  assert.equal(rows.length, 20);
  const all = Array.from({ length: 45 }, (_, index) => ({ ...rows[0], id: `row-${String(index).padStart(2, "0")}`, playerName: index % 2 ? "Alpha" : "中文球员" }));
  const result = selectDataRows(all, { kind: "all", search: "中文", dimension: "team", item: "A&B / 队", page: "999" });
  assert.equal(result.total, 23); assert.equal(result.page, 2); assert.equal(result.rows.length, 3);
  assert.equal(selectDataRows(all, { page: "NaN" }).page, 1);
});
test("drill links retain scope and neutral/missing baselines never become positive returns", () => {
  const url = new URL(dataHref({ sport: "Basketball", wish: "wish-1", q: "A&B" }, { tab: "structure", structure: "team" }, { tab: "details", dimension: "team", item: "A&B / 队" }), "http://localhost");
  assert.equal(url.searchParams.get("wish"), "wish-1"); assert.equal(url.searchParams.get("q"), "A&B"); assert.equal(url.searchParams.get("item"), "A&B / 队");
  assert.equal(profitTone(null), "neutral"); assert.equal(profitTone(0), "neutral"); assert.equal(profitTone(-1), "negative");
  assert.equal(valuationChangeAvailable({ baselineValuedCardCount: 0, currentValuedCardCount: 3 }), false);
  assert.equal(valuationChangeAvailable({ baselineValuedCardCount: 2, currentValuedCardCount: 0 }), false);
});
test("missing FX retains physical holdings and marks converted amounts unknown", () => {
  const source = card("foreign");
  source.transactions = source.transactions.map(row => ({ ...row, currency: "USD" }));
  source.valuations = source.valuations.map(row => ({ ...row, currency: "USD" }));
  const workspace = collect([source]);
  assert.equal(workspace.quantity, 2);
  assert.equal(workspace.rows[0].value, null);
  assert.equal(workspace.rows[0].cost, null);
  assert.ok(workspace.rows[0].issues.some(issue => issue.key === "missing_fx"));
});

test("attribute counts include sold archives while value shares use only quoted holdings", () => {
  const held = { ...card("held"), isRookie: true, isAutograph: true };
  const sold = { ...card("sold"), holdingQuantity: 0, collectionStatus: "sold", isRookie: true, isAutograph: true };
  sold.transactions.push({ kind: "sale", quantity: 2, amountMinor: 15000n, currency: "CNY", occurredAt: asOf });
  const unknown = { ...card("unknown", 3), isRookie: true, isSerialNumbered: true };
  unknown.valuations = unknown.valuations.map(row => ({ ...row, currency: "USD" }));
  const zero = { ...card("zero", 1), isPatch: true };
  zero.valuations = zero.valuations.map(row => ({ ...row, amountMinor: 0n }));
  const workspace = collect([held, sold, unknown, card("other", 1), zero]);
  assert.deepEqual(workspace.attributes.isRookie, { count: 3, quantity: 5, value: 160, valuedCount: 1, soldCount: 1 });
  assert.deepEqual(workspace.attributes.isAutograph, { count: 2, quantity: 2, value: 160, valuedCount: 1, soldCount: 1 });
  assert.deepEqual(workspace.attributes.isSerialNumbered, { count: 1, quantity: 3, value: 0, valuedCount: 0, soldCount: 0 });
  assert.deepEqual(workspace.attributes.isPatch, { count: 1, quantity: 1, value: 0, valuedCount: 1, soldCount: 0 });
  assert.equal(workspace.closed.team["A&B / 队"], 1);
  assert.equal(workspace.physical.team["A&B / 队"], 7);
});

test("sold archive drill-through excludes partial sales and retains the selected dimension", () => {
  const sold = { ...card("closed"), holdingQuantity: 0 };
  sold.transactions.push({ kind: "sale", quantity: 2, amountMinor: 15000n, currency: "CNY", occurredAt: asOf });
  const partial = { ...card("partial"), holdingQuantity: 1 };
  partial.transactions.push({ kind: "sale", quantity: 1, amountMinor: 7500n, currency: "CNY", occurredAt: asOf });
  const workspace = collect([sold, partial, card("held")]);
  assert.equal(workspace.closed.team["A&B / 队"], 1);
  const result = selectDataRows(workspace.rows, { kind: "all", closed: "1", dimension: "team", item: "A&B / 队" });
  assert.deepEqual(result.rows.map(row => row.id), ["closed"]);
  assert.equal(selectDataRows(workspace.rows, { kind: "all", closed: "1", dimension: "team", item: "Other" }).total, 0);
});

test("summary collection retains the same aggregates and stable top five without a detail list", () => {
  const cards = Array.from({ length: 53 }, (_, index) => ({ ...card(`row-${String(index).padStart(2, "0")}`, index % 3 + 1), isRookie: index % 2 === 0 })).reverse();
  cards.find(item => item.id === "row-00")!.valuations = [];
  const full = collect(cards), summary = collect(cards, false);
  for (const key of ["quantity", "currency", "top", "issueCounts", "qualityCount", "physical", "closed", "attributes"] as const) assert.deepEqual(summary[key], full[key], key);
  assert.deepEqual(summary.top.map(row => row.id), ["row-02", "row-05", "row-08", "row-11", "row-14"]);
  assert.deepEqual(summary.rows, []);
  assert.equal(summary.total, 53);
  assert.equal(full.pages, 3);
});

test("workspace state shares one whitelist for URLs and action return links", () => {
  const state = normalizePortfolioWorkspaceState({ tab: "trends", financialRange: "6", activityRange: "all", closed: "1", search: "中文 A&B", page: 2, order: "x".repeat(201), returnTo: "https://example.com", q: "not presentation state" });
  assert.deepEqual(state, { tab: "trends", search: "中文 A&B", closed: "1", financialRange: "6", activityRange: "all" });
  for (const input of [null, [], "invalid", 42]) assert.deepEqual(normalizePortfolioWorkspaceState(input), {});
});

test("structure names matching JavaScript properties retain numeric counts and plain JSON", () => {
  const cards = ["__proto__", "constructor", "toString"].flatMap((team, index) => {
    const sold = { ...card(`closed-${index}`), team, holdingQuantity: 0 };
    sold.transactions.push({ kind: "sale", quantity: 2, amountMinor: 15000n, currency: "CNY", occurredAt: asOf });
    return [{ ...card(`held-${index}`, index + 1), team }, sold];
  });
  const workspace = collect(cards, false);
  const decoded = JSON.parse(JSON.stringify(workspace));
  for (const [index, name] of ["__proto__", "constructor", "toString"].entries()) {
    assert.equal(dataGroupCount(workspace.physical, "team", name), index + 1);
    assert.equal(dataGroupCount(workspace.closed, "team", name), 1);
    assert.equal(decoded.physical.team[name], index + 1);
    assert.equal(decoded.closed.team[name], 1);
    assert.equal(dataGroupCount({}, "team", name), 0);
    assert.equal(dataGroupCount({ team: {} }, "team", name), 0);
  }
  assert.equal(Object.getPrototypeOf(workspace.physical.team), Object.prototype);
});
