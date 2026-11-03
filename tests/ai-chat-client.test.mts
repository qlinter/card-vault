import assert from "node:assert/strict";
import test from "node:test";
import { requestAiChatText, requestAiChatTextResult } from "../lib/ai-chat-client.ts";
import {
  getActiveAiSettingsFromDraft,
  getChatCompletionsHeaders,
  getChatCompletionsUrl,
  getModelsUrl,
  type ActiveAiSettings
} from "../lib/ai-settings.ts";
import core from "../lib/ai-settings-core.js";

const settings: ActiveAiSettings = {
  provider: "openai",
  endpoint: "https://api.openai.com/v1/chat/completions",
  apiKey: "test-key",
  model: "test-model"
};

test("user cancellation aborts the upstream request without retrying", async t => {
  const controller = new AbortController();
  const original = globalThis.fetch;
  t.after(() => { globalThis.fetch = original; });
  let calls = 0;
  globalThis.fetch = async (_input, init) => {
    calls++;
    return new Promise((_resolve, reject) => {
      init!.signal!.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
      controller.abort();
    });
  };
  await assert.rejects(() => requestAiChatText(settings, { messages: [], maxTokens: 8, operation: "test", signal: controller.signal }), { name: "AbortError" });
  assert.equal(calls, 1);
});

test("an already cancelled request never contacts the upstream", async t => {
  const original = globalThis.fetch;
  t.after(() => { globalThis.fetch = original; });
  globalThis.fetch = async () => { throw new Error("should not fetch"); };
  await assert.rejects(() => requestAiChatText(settings, { messages: [], maxTokens: 8, operation: "test", signal: AbortSignal.abort() }), { name: "AbortError" });
});

test("DeepSeek vision uses the official model, Bearer auth and non-thinking JSON output", async (t) => {
  const deepseek: ActiveAiSettings = {
    provider: "deepseek", endpoint: "https://api.deepseek.com/chat/completions",
    apiKey: "mock-deepseek-key", model: "deepseek-flash"
  };
  const messages = [{ role: "user" as const, content: [
    { type: "text", text: "Read the card and return JSON." },
    { type: "image_url", image_url: { url: "data:image/png;base64,bW9jaw==", detail: "high" } }
  ] }];
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  let calls = 0;
  globalThis.fetch = async (input, init) => {
    calls++;
    assert.equal(String(input), deepseek.endpoint);
    assert.equal(new Headers(init?.headers).get("Authorization"), "Bearer mock-deepseek-key");
    const body = JSON.parse(String(init?.body));
    assert.equal(body.model, "deepseek-flash");
    assert.equal(body.max_tokens, 4096);
    assert.equal(body.max_completion_tokens, undefined);
    assert.deepEqual(body.thinking, { type: "disabled" });
    assert.deepEqual(body.response_format, { type: "json_object" });
    assert.deepEqual(body.messages, messages);
    return Response.json({ choices: [{ message: { content: '{"playerName":"Test Player"}' } }] });
  };
  const result = await requestAiChatText(deepseek, { messages, maxTokens: 4096, operation: "识图", responseFormat: "json_object" });
  assert.equal(JSON.parse(result).playerName, "Test Player");
  assert.equal(calls, 1);
  assert.equal(getModelsUrl(deepseek), "https://api.deepseek.com/models");
});

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

test("OpenAI official vision endpoint uses Bearer auth and the selected GPT-5 model", async (t) => {
  const v1Settings: ActiveAiSettings = {
    provider: "openai",
    endpoint: "https://api.openai.com/v1/chat/completions",
    apiKey: "test-key",
    model: "gpt-5.4-mini"
  };
  const messages = [{ role: "user" as const, content: [{ type: "text", text: "Read this card" }, { type: "image_url", image_url: { url: "data:image/png;base64,bW9jaw==" } }] }];
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
    messages,
    maxTokens: 32,
    temperature: 0.2,
    operation: "测试"
  });

  assert.equal(result, "OK");
  assert.equal(requestedUrl, "https://api.openai.com/v1/chat/completions");
  assert.equal(getChatCompletionsHeaders(v1Settings).Authorization, "Bearer test-key");
  assert.equal(getModelsUrl(v1Settings), "https://api.openai.com/v1/models");
  assert.deepEqual(requestBody.messages, messages);
  assert.equal(requestBody.model, "gpt-5.4-mini");
  assert.equal(requestBody.max_completion_tokens, 32);
  assert.equal("temperature" in requestBody, false);
});

test("saved Azure resource endpoints remain isolated custom profiles", () => {
  for (const endpoint of ["https://example.services.ai.azure.com", "https://example.openai.azure.com/openai/v1/chat/completions"]) {
    const migrated = core.normalizeSettings({ provider: "azure", azure: { endpoint, apiKey: "azure-key", deployment: "vision" } });
    const active = getActiveAiSettingsFromDraft(migrated);
    assert.equal(active.provider, "custom");
    assert.match(getChatCompletionsUrl(active), /^https:\/\/example\.(?:services\.ai|openai)\.azure\.com\/openai\/v1\/chat\/completions$/);
    assert.match(getModelsUrl(active), /\/openai\/v1\/models$/);
    assert.deepEqual(getChatCompletionsHeaders(active), { "Content-Type": "application/json", "api-key": "azure-key" });
    assert.equal(migrated.openai.apiKey, "");
  }
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

test("AI client retries without temperature when an upstream model rejects it", async (t) => {
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
