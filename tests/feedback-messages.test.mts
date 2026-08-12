import assert from "node:assert/strict";
import test from "node:test";
import {
  cardSuccessMessages,
  commonSuccessMessages,
  errorMessage,
  resolveSuccessMessage,
  shareEditSuccessMessages,
  shareListSuccessMessages
} from "../lib/feedback-messages.ts";

test("feedback success messages resolve common and scenario-specific codes", () => {
  assert.equal(resolveSuccessMessage("created", commonSuccessMessages), "添加成功");
  assert.equal(resolveSuccessMessage("history-added", cardSuccessMessages), "财务记录已添加");
  assert.equal(resolveSuccessMessage("deleted", shareListSuccessMessages), "分享集已删除。");
  assert.equal(resolveSuccessMessage("updated", shareEditSuccessMessages), "分享集已保存。");
  assert.equal(resolveSuccessMessage("unknown", shareListSuccessMessages), null);
  assert.equal(resolveSuccessMessage("unknown", commonSuccessMessages, { passthroughUnknown: true }), "unknown");
});

test("feedback errors normalize Error and unknown values", () => {
  assert.equal(errorMessage(new Error("具体失败原因"), "请稍后重试。"), "具体失败原因");
  assert.equal(errorMessage(new Error("  "), "请稍后重试。"), "请稍后重试。");
  assert.equal(errorMessage("not-an-error", "请稍后重试。"), "请稍后重试。");
});
