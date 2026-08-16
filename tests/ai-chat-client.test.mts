import assert from "node:assert/strict";
import test from "node:test";
import { requestAiChatText, requestAiChatTextResult } from "../lib/ai-chat-client.ts";
import {
  getChatCompletionsHeaders,
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

test("custom AI uses the configured OpenAI-compatible endpoints, model, and authorization header", async (t) => {
  const customSettings: ActiveAiSettings = {
    provider: "custom",
    id: "private-gateway",
    name: "Private Gateway",
    endpoint: "https://ai.example.test/v1/chat/completions",
    modelsEndpoint: "",
    apiKey: "custom-secret",
    model: "vision-model",
    apiKeyHeader: "X-API-Key",
    apiKeyPrefix: "Token"
  };
  assert.equal(getChatCompletionsUrl(customSettings), "https://ai.example.test/v1/chat/completions");
  assert.equal(getModelsUrl(customSettings), "https://ai.example.test/v1/models");
  assert.deepEqual(getChatCompletionsHeaders(customSettings), {
    "Content-Type": "application/json",
    "X-API-Key": "Token custom-secret"
  });

  const originalFetch = globalThis.fetch;
  let requestBody: Record<string, unknown> = {};
  t.after(() => {
    globalThis.fetch = originalFetch;
  });
  globalThis.fetch = async (_input, init) => {
    requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return Response.json({ choices: [{ message: { content: "CUSTOM OK" } }] });
  };

  const result = await requestAiChatText(customSettings, {
    messages: [{ role: "user", content: "test" }],
    maxTokens: 16,
    operation: "测试"
  });
  assert.equal(result, "CUSTOM OK");
  assert.equal(requestBody.model, "vision-model");
});

test("custom AI supports local services without an API key", () => {
  const localSettings: ActiveAiSettings = {
    provider: "custom",
    id: "local-ai",
    name: "Local AI",
    endpoint: "http://127.0.0.1:1234/v1/chat/completions",
    modelsEndpoint: "http://127.0.0.1:1234/v1/models",
    apiKey: "",
    model: "local-model",
    apiKeyHeader: "Authorization",
    apiKeyPrefix: "Bearer"
  };
  assert.deepEqual(getChatCompletionsHeaders(localSettings), { "Content-Type": "application/json" });
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

test("AI client requests JSON mode and falls back when a compatible provider rejects it", async (t) => {
  const originalFetch = globalThis.fetch;
  const requestBodies: Array<Record<string, unknown>> = [];
  t.after(() => { globalThis.fetch = originalFetch; });

  globalThis.fetch = async (_input, init) => {
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    requestBodies.push(body);
    if (requestBodies.length === 1) {
      return new Response(JSON.stringify({ error: { message: "Unsupported parameter: response_format" } }), { status: 400 });
    }
    return Response.json({ choices: [{ finish_reason: "stop", message: { content: "{\"ok\":true}" } }] });
  };

  const result = await requestAiChatTextResult(settings, {
    messages: [{ role: "user", content: "return JSON" }],
    maxTokens: 32,
    responseFormat: "json_object",
    operation: "测试"
  });

  assert.deepEqual(requestBodies[0].response_format, { type: "json_object" });
  assert.equal("response_format" in requestBodies[1], false);
  assert.equal(result.text, "{\"ok\":true}");
  assert.equal(result.finishReason, "stop");
});

test("AI client retries transient rate limits before succeeding", async (t) => {
  const originalFetch = globalThis.fetch;
  let attempts = 0;
  t.after(() => { globalThis.fetch = originalFetch; });

  globalThis.fetch = async () => {
    attempts += 1;
    if (attempts === 1) return new Response("rate limited", { status: 429, headers: { "retry-after": "0" } });
    return Response.json({ choices: [{ message: { content: "OK after retry" } }] });
  };

  const result = await requestAiChatText(settings, {
    messages: [{ role: "user", content: "test" }],
    maxTokens: 16,
    operation: "测试"
  });

  assert.equal(result, "OK after retry");
  assert.equal(attempts, 2);
});
