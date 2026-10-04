import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeCardCollectionStatus,
  normalizeCardTags,
  normalizeCardVisibility,
  optionalCardDate,
  optionalCardText,
  resolveIsSerialNumbered
} from "../lib/card-domain.ts";
import { buildCardFilters, buildCardSorting } from "../lib/card-helpers.ts";

test("serial numbered status is explicit or inferred from numbering fields", () => {
  assert.equal(resolveIsSerialNumbered({ explicit: false, serialNumber: "", serialRange: "" }), false);
  assert.equal(resolveIsSerialNumbered({ explicit: true, serialNumber: "", serialRange: "" }), true);
  assert.equal(resolveIsSerialNumbered({ explicit: false, serialNumber: "12", serialRange: "" }), true);
  assert.equal(resolveIsSerialNumbered({ explicit: false, serialNumber: "", serialRange: "/99" }), true);
});

test("card domain validation rejects unknown states and oversized text", () => {
  assert.equal(normalizeCardVisibility("public"), "public");
  assert.equal(normalizeCardCollectionStatus("grading"), "grading");
  assert.throws(() => normalizeCardVisibility("friends"), /公开状态/);
  assert.throws(() => normalizeCardCollectionStatus("archived"), /收藏状态/);
  assert.throws(() => optionalCardText("x".repeat(241), "字段"), /240/);
});

test("card dates accept only real ISO calendar dates", () => {
  assert.equal(optionalCardDate("", "购买日期"), null);
  assert.equal(optionalCardDate("2024-02-29", "购买日期")?.toISOString(), "2024-02-29T00:00:00.000Z");
  assert.throws(() => optionalCardDate("2026-02-29", "购买日期"), /购买日期格式无效/);
  assert.throws(() => optionalCardDate("2026-02-30", "购买日期"), /购买日期格式无效/);
  assert.throws(() => optionalCardDate("08\/21\/2026", "购买日期"), /购买日期格式无效/);
});

test("card tags are normalized, deduplicated, and bounded", () => {
  assert.equal(normalizeCardTags(" rookie, psa, rookie "), "rookie,psa");
  assert.throws(() => normalizeCardTags("x".repeat(41)), /单个标签/);
});

test("cost sorting uses current reports with stable ordering", () => {
  assert.deepEqual(buildCardSorting("costCnyAsc"), [{ report: { remainingCostMinor: { sort: "asc", nulls: "last" } } }, { id: "asc" }]);
  assert.deepEqual(buildCardSorting("costCnyDesc"), [{ report: { remainingCostMinor: { sort: "desc", nulls: "last" } } }, { id: "asc" }]);
  for (const sort of [undefined, "priceAsc", "priceDesc", "unknown"]) {
    assert.deepEqual(buildCardSorting(sort), [{ createdAt: "desc" }, { id: "asc" }]);
  }
  assert.deepEqual(buildCardSorting("yearAsc"), [{ year: "asc" }, { createdAt: "desc" }, { id: "asc" }]);
  assert.deepEqual(buildCardSorting("yearDesc"), [{ year: "desc" }, { createdAt: "desc" }, { id: "asc" }]);
  const filter = buildCardFilters({ q: "dealer" });
  assert.ok(JSON.stringify(filter).includes(JSON.stringify({ transactions: { some: { kind: "purchase", source: { contains: "dealer" } } } })));
});

test("serial-numbered filtering uses the derived boolean instead of numbering text", () => {
  assert.deepEqual(buildCardFilters({ isSerialNumbered: "true" }), { AND: [{ isSerialNumbered: true }] });
  assert.deepEqual(buildCardFilters({ isSerialNumbered: "false" }), { AND: [{ isSerialNumbered: false }] });
  assert.deepEqual(buildCardFilters({ isSerialNumbered: "invalid" }), {});
});

test("one-of-one filtering recognizes current serial-range formats", () => {
  assert.deepEqual(buildCardFilters({ isOneOfOne: "true" }), {
    AND: [{ serialRange: { in: ["1", "/1", "1/1"] } }]
  });
  assert.deepEqual(buildCardFilters({ isOneOfOne: "false" }), {
    AND: [{ OR: [{ serialRange: null }, { serialRange: { notIn: ["1", "/1", "1/1"] } }] }]
  });
  assert.deepEqual(buildCardFilters({ isOneOfOne: "invalid" }), {});
});

test("valuation sorting uses current reports and puts missing values last", () => {
  assert.deepEqual(buildCardSorting("valueCnyAsc"), [{ report: { valueMinor: { sort: "asc", nulls: "last" } } }, { id: "asc" }]);
  assert.deepEqual(buildCardSorting("valueCnyDesc"), [{ report: { valueMinor: { sort: "desc", nulls: "last" } } }, { id: "asc" }]);
});
