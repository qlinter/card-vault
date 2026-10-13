import test from "node:test";
import assert from "node:assert/strict";
import { emptyScoutQuery, normalizeScoutQuery, scoutLinks, scoutAmount, scoutMoneyInput, scoutCardIds } from "../lib/scout-domain.ts";
test("plain keywords normalize whitespace and encode Chinese and punctuation for external searches", () => {
  const query = normalizeScoutQuery({ keyword: "  A&B   卡款 #1 " });
  assert.deepEqual(query, { keyword: "A&B 卡款 #1" });
  const [hobby, ebay, point] = scoutLinks(query);
  assert.equal(new URL(hobby.href).searchParams.get("keyword"), query.keyword);
  assert.equal(new URL(ebay.href).searchParams.get("_nkw"), query.keyword);
  assert.equal(point.href, "https://130point.com/sales/");
  assert.equal(new URL(scoutLinks(emptyScoutQuery)[1].href).searchParams.has("LH_Sold"), false);
  assert.throws(() => normalizeScoutQuery({ keyword: "a".repeat(501) }));
  for (const value of [null, [], { keyword: 1 }]) assert.throws(() => normalizeScoutQuery(value));
});
test("multi-card binding validates complete unique selections and canonicalizes stale-write comparisons", () => {
  assert.deepEqual(scoutCardIds(["b", "a"]), ["a", "b"]);
  assert.deepEqual(scoutCardIds([], true), []);
  for (const value of [undefined, null, [], "a", [""], [" "], [1], ["a", "a"], ["a".repeat(161)], Array.from({ length: 501 }, (_, i) => String(i))]) assert.throws(() => scoutCardIds(value));
  assert.equal(scoutCardIds(Array.from({ length: 500 }, (_, i) => String(i))).length, 500);
});
test("wish budgets distinguish zero and unknown amounts and retain exact minor units", () => {
  assert.equal(scoutAmount("0"), 0n); assert.equal(scoutAmount("123.45"), 12345n); assert.equal(scoutAmount("1.2"), 120n);
  for (const value of ["", null, undefined]) assert.equal(scoutAmount(value), null);
  for (const value of ["-1", "1.234", "1e3", "abc", 10]) assert.throws(() => scoutAmount(value));
  assert.equal(scoutMoneyInput(null), ""); assert.equal(scoutMoneyInput("0"), "0.00"); assert.equal(scoutMoneyInput("12345"), "123.45");
});
