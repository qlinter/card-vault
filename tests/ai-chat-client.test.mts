import assert from "node:assert/strict";
import test from "node:test";
import { requestAiChatText } from "../lib/ai-chat-client.ts";
import {
  getChatCompletionsUrl,
  getModelsUrl,
  type ActiveAiSettings
} from "../lib/ai-settings.ts";

const settings: ActiveAiSettings = {
  provider: "azure",
  endpoint: "https://example.openai.azure.com",
  apiKey: "test-key",
  deployment: "test-model"
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

test("AI client translates an upstream network failure into an actionable message", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });
  globalThis.fetch = async () => {
    throw new TypeError("Failed to fetch");
  };

  await assert.rejects(
    requestAiChatText(settings, {
      messages: [{ role: "user", content: "test" }],
      maxTokens: 8,
      operation: "主题生成"
    }),
    /检查网络、Endpoint 和代理设置/
  );
});

test("Azure v1 routes GPT-5.4 through the unified API", async (t) => {
  const v1Settings: ActiveAiSettings = {
    provider: "azure",
    endpoint: "https://example.openai.azure.com",
    apiKey: "test-key",
    deployment: "gpt-5.4"
  };
  const originalFetch = globalThis.fetch;
  let requestedUrl = "";
  let requestBody: Record<string, unknown> = {};
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  globalThis.fetch = async (input, init) => {
    requestedUrl = String(input);
    requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return Response.json({ choices: [{ message: { content: "OK" } }] });
  };

  const result = await requestAiChatText(v1Settings, {
    messages: [{ role: "user", content: "test" }],
    maxTokens: 32,
    temperature: 0.2,
    operation: "测试"
  });

  assert.equal(result, "OK");
  assert.equal(requestedUrl, "https://example.openai.azure.com/openai/v1/chat/completions");
  assert.equal(requestBody.model, "gpt-5.4");
  assert.equal(requestBody.max_completion_tokens, 32);
  assert.equal("temperature" in requestBody, false);
});

test("Azure v1 accepts unified resource endpoints and exposes the models route", () => {
  const unifiedSettings: ActiveAiSettings = {
    provider: "azure",
    endpoint: "https://example.services.ai.azure.com",
    apiKey: "test-key",
    deployment: "custom-deployment"
  };

  assert.equal(
    getChatCompletionsUrl(unifiedSettings),
    "https://example.services.ai.azure.com/openai/v1/chat/completions"
  );
  assert.equal(getModelsUrl(unifiedSettings), "https://example.services.ai.azure.com/openai/v1/models");

  const openAiResourceSettings: ActiveAiSettings = {
    ...unifiedSettings,
    endpoint: "https://example.openai.azure.com"
  };
  assert.equal(
    getChatCompletionsUrl(openAiResourceSettings),
    "https://example.openai.azure.com/openai/v1/chat/completions"
  );
  assert.equal(getModelsUrl(openAiResourceSettings), "https://example.openai.azure.com/openai/v1/models");
});

test("AI client retries without temperature when an Azure deployment rejects it", async (t) => {
  const originalFetch = globalThis.fetch;
  const requestBodies: Array<Record<string, unknown>> = [];
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  globalThis.fetch = async (_input, init) => {
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    requestBodies.push(body);
    if (requestBodies.length === 1) {
      return new Response(
        JSON.stringify({ error: { message: "Unsupported parameter: temperature is not supported with this model." } }),
        { status: 400 }
      );
    }
    return Response.json({ choices: [{ message: { content: "OK" } }] });
  };

  const result = await requestAiChatText(settings, {
    messages: [{ role: "user", content: "test" }],
    maxTokens: 32,
    temperature: 0.2,
    operation: "测试"
  });

  assert.equal(result, "OK");
  assert.equal(requestBodies.length, 2);
  assert.equal(requestBodies[0].temperature, 0.2);
  assert.equal("temperature" in requestBodies[1], false);
});
