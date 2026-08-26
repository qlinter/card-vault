import assert from "node:assert/strict";
import test from "node:test";
import {
  defaultInitialQuantityForStatus,
  parseInitialCardQuantity
} from "../lib/card-quantity.ts";

test("已售和目标卡默认数量为 0，其余状态默认数量为 1", () => {
  assert.equal(defaultInitialQuantityForStatus("sold"), 0);
  assert.equal(defaultInitialQuantityForStatus("target"), 0);
  assert.equal(defaultInitialQuantityForStatus("holding"), 1);
  assert.equal(defaultInitialQuantityForStatus("listed"), 1);
  assert.equal(defaultInitialQuantityForStatus("grading"), 1);
});

test("已售和目标卡支持手动设置非负数量", () => {
  assert.equal(parseInitialCardQuantity("", "sold"), 0);
  assert.equal(parseInitialCardQuantity("0", "target"), 0);
  assert.equal(parseInitialCardQuantity("2", "sold"), 2);
  assert.equal(parseInitialCardQuantity("3", "target"), 3);
});

test("其它状态仍要求至少 1 张，所有状态均拒绝无效数量", () => {
  assert.equal(parseInitialCardQuantity("", "holding"), 1);
  assert.throws(() => parseInitialCardQuantity("0", "holding"), /至少为 1/);
  assert.throws(() => parseInitialCardQuantity("-1", "sold"), /非负整数/);
  assert.throws(() => parseInitialCardQuantity("1.5", "target"), /非负整数/);
});
