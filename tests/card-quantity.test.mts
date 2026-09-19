import assert from "node:assert/strict";
import test from "node:test";
import {
  defaultInitialQuantityForStatus,
  parseInitialCardQuantity
} from "../lib/card-quantity.ts";

test("已售默认数量为 0，四种持有状态默认数量为 1", () => {
  assert.equal(defaultInitialQuantityForStatus("sold"), 0);
  assert.equal(defaultInitialQuantityForStatus("pending_grading"), 1);
  assert.equal(defaultInitialQuantityForStatus("holding"), 1);
  assert.equal(defaultInitialQuantityForStatus("listed"), 1);
  assert.equal(defaultInitialQuantityForStatus("grading"), 1);
});

test("已售必须为零数量，目标卡不再是有效收藏状态", () => {
  assert.equal(parseInitialCardQuantity("", "sold"), 0);
  assert.equal(parseInitialCardQuantity("0", "sold"), 0);
  assert.throws(() => parseInitialCardQuantity("2", "sold"), /已售卡片的持有数量必须为 0/);
  assert.throws(() => parseInitialCardQuantity("0", "target"), /不支持的收藏状态/);
});

test("其它状态仍要求至少 1 张，所有状态均拒绝无效数量", () => {
  assert.equal(parseInitialCardQuantity("", "holding"), 1);
  assert.throws(() => parseInitialCardQuantity("0", "holding"), /至少为 1/);
  assert.throws(() => parseInitialCardQuantity("-1", "sold"), /非负整数/);
  assert.throws(() => parseInitialCardQuantity("1.5", "pending_grading"), /非负整数/);
  for (const status of ["holding", "pending_grading", "grading", "listed"]) {
    assert.equal(parseInitialCardQuantity("3", status), 3);
    assert.throws(() => parseInitialCardQuantity("0", status), /至少为 1/);
  }
});
