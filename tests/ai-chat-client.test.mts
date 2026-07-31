import assert from "node:assert/strict";
import test from "node:test";
import { requestAiChatText } from "../lib/ai-chat-client.ts";
import type { ActiveAiSettings } from "../lib/ai-settings.ts";

const settings: ActiveAiSettings = {
  provider: "azure",
  endpoint: "https://example.openai.azure.com",
  apiKey: "test-key",
  deployment: "test-model",
  apiVersion: "2024-02-15-preview"
};

test("AI client retries with max_tokens when max_completion_tokens is unsupported", async (t) => {
  const originalFetch = globalThis.fetch;
  const requestBodies: Array<Record<string, unknown>> = [];
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  globalThis.fetch = async (_input, init) => {
    requestBodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
    if (requestBodies.length === 1) {
      return new Response(
        JSON.stringify({ error: { message: "Unsupported parameter: max_completion_tokens" } }),
        { status: 400 }
      );
    }

    return Response.json({ choices: [{ message: { content: "OK" } }] });
  };

  const result = await requestAiChatText(settings, {
    messages: [{ role: "user", content: "test" }],
    maxTokens: 8,
    operation: "测试"
  });

  assert.equal(result, "OK");
  assert.equal(requestBodies.length, 2);
  assert.equal(requestBodies[0].max_completion_tokens, 8);
  assert.equal(requestBodies[1].max_tokens, 8);
});
