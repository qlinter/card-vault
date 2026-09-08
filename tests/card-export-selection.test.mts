import assert from "node:assert/strict";
import test from "node:test";
import { parseExportSelection } from "../lib/card-export-selection.ts";

test("export selection distinguishes no filter from an explicitly empty selection", () => {
  assert.equal(parseExportSelection(null), undefined);
  assert.deepEqual(parseExportSelection('["one","two","one"]'), ["one", "two"]);
  for (const value of ["[]", "{}", "null", '[" "]', '[1]', "bad json", Array(10001).fill("one")]) {
    assert.throws(() => parseExportSelection(value));
  }
});
