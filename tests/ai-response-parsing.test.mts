import assert from "node:assert/strict";
import test from "node:test";
import { extractJsonRecord, responseToText } from "../lib/ai-response-parsing.ts";

test("extractJsonRecord accepts fenced JSON and ignores surrounding text", () => {
  const parsed = extractJsonRecord('```json\n{"title":"精选展馆","description":"收藏叙事"}\n```');
  assert.deepEqual(parsed, { title: "精选展馆", description: "收藏叙事" });
});

test("responseToText removes model thinking blocks", () => {
  const text = responseToText({
    choices: [
      {
        message: {
          content: '<think>internal reasoning</think>\n{"title":"最终主题"}'
        }
      }
    ]
  });

  assert.equal(text, '{"title":"最终主题"}');
});
