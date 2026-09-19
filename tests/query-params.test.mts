import assert from "node:assert/strict";
import test from "node:test";
import { buildQueryHref, encodeReturnTo, normalizeReturnTo } from "../lib/query-params.ts";

test("collection navigation round-trips special characters without injecting query fields", () => {
  const query = { q: "卡片 & + / #?viewId=other", isAutograph: "false", sort: "yearAsc", viewId: "view&1", error: undefined, sport: "" };
  const href = buildQueryHref("/portfolio", query);
  const url = new URL(href, "http://localhost");
  assert.equal(url.pathname, "/portfolio");
  assert.equal(url.hash, "");
  assert.deepEqual(Object.fromEntries(url.searchParams), { q: query.q, isAutograph: "false", sort: "yearAsc", viewId: "view&1" });
  assert.equal(buildQueryHref("/", { q: "", sort: undefined }), "/");
  assert.equal(buildQueryHref("/portfolio", {}), "/portfolio");
});

test("return context accepts home filters and entry workbench drafts", () => {
  assert.equal(normalizeReturnTo("/"), "/");
  assert.equal(normalizeReturnTo("/?sport=Basketball"), "/?sport=Basketball");
  assert.equal(
    normalizeReturnTo("/portfolio?viewId=view-1&compareLeft=current"),
    "/portfolio?viewId=view-1&compareLeft=current"
  );
  assert.equal(
    normalizeReturnTo("/cards/new?draft=draft-1&queue=queue-1"),
    "/cards/new?draft=draft-1&queue=queue-1"
  );
  assert.equal(
    encodeReturnTo("/cards/new?draft=draft-1&queue=queue-1"),
    "?returnTo=%2Fcards%2Fnew%3Fdraft%3Ddraft-1%26queue%3Dqueue-1"
  );
});

test("return context rejects external and unrelated application paths", () => {
  assert.equal(normalizeReturnTo("https://example.com"), undefined);
  assert.equal(normalizeReturnTo("//example.com/cards/new"), undefined);
  assert.equal(normalizeReturnTo("/settings"), undefined);
  assert.equal(normalizeReturnTo("/cards/existing"), undefined);
});

test("export return links retain local search state and reject lookalike routes", () => {
  for (const base of ["/settings", "/settings/data"]) {
    const target = base + "?exportQ=Jordan&exportPage=1&exportView=table#data-export";
    assert.equal(normalizeReturnTo(target), target);
    assert.equal(normalizeReturnTo(base + "#data-export"), base + "#data-export");
  }
  for (const target of ["/settings.evil.test?exportPage=1", "/settings/data/../../outside?x=1", "//evil.test/settings?exportPage=1"]) assert.equal(normalizeReturnTo(target), undefined);
});
