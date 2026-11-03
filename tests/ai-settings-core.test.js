const assert = require("node:assert/strict");
const test = require("node:test");
const { normalizeSettings, mergeAiSettings, publicAiSettings } = require("../lib/ai-settings-core");

test("new defaults use official OpenAI and migrate configured Azure without credential reuse", () => {
  const { builtInAiProviders } = require("../lib/ai-settings-core");
  assert.deepEqual(Object.keys(builtInAiProviders), ["openai", "minimax", "deepseek"]);
  const defaults = normalizeSettings();
  assert.equal(defaults.provider, "openai");
  assert.equal(defaults.openai.endpoint, "https://api.openai.com/v1/chat/completions");
  assert.equal(defaults.openai.model, "gpt-5.4-mini");
  assert.equal(defaults.openai.apiKey, "");
  assert.deepEqual(normalizeSettings({ provider: "azure", azure: {} }), defaults);
  const migrated = normalizeSettings({ provider: "azure", azure: { endpoint: "https://resource.openai.azure.com", apiKey: "legacy-secret", deployment: "vision" }, customProviders: [{ id: "legacy-azure", name: "Existing" }] });
  assert.equal(migrated.provider, "custom");
  assert.equal(migrated.activeCustomId, "legacy-azure-2");
  assert.equal(migrated.openai.apiKey, "");
  assert.equal(migrated.customProviders[1].apiKey, "legacy-secret");
  assert.equal(migrated.customProviders[1].endpoint, "https://resource.openai.azure.com/openai/v1/chat/completions");
  assert.equal(migrated.customProviders[1].apiKeyHeader, "api-key");
  assert.equal(migrated.customProviders[1].apiKeyPrefix, "");
  assert.deepEqual(normalizeSettings(migrated), migrated);
});

test("shared AI settings normalization applies consistent endpoints, defaults, and unique custom ids", () => {
  const settings = normalizeSettings({
    provider: "custom",
    activeCustomId: "same",
    openai: { endpoint: " https://openai.example/ ", model: " model " },
    minimax: {},
    customProviders: [
      { id: "same", name: " First ", endpoint: "https://first.example/v1/", model: "one" },
      { id: "same", name: "Second", endpoint: "https://second.example/v1/", model: "two" }
    ]
  });

  assert.equal(settings.openai.endpoint, "https://openai.example");
  assert.equal(settings.openai.model, "model");
  assert.equal(settings.minimax.endpoint, "https://api.minimax.io/v1/chat/completions");
  assert.equal(settings.minimax.model, "MiniMax-VL-01");
  assert.deepEqual(settings.customProviders.map((item) => item.id), ["same", "same-2"]);
  assert.equal(settings.customProviders[0].endpoint, "https://first.example/v1");
  assert.equal(settings.activeCustomId, "same");
});

test("partial AI drafts preserve credentials by provider and custom id without mutating saved settings", () => {
  const saved = normalizeSettings({
    provider: "custom", activeCustomId: "a",
    openai: { apiKey: "openai-secret", model: "original" },
    deepseek: { apiKey: "deepseek-secret" },
    customProviders: [
      { id: "a", apiKey: "a-secret", model: "a-model" },
      { id: "b", apiKey: "b-secret", model: "b-model" }
    ]
  });
  const before = structuredClone(saved);
  const merged = mergeAiSettings(saved, {
    provider: "deepseek", openai: { apiKey: undefined },
    deepseek: { model: "next-model" },
    customProviders: [{ id: "b", name: "Renamed" }, { id: "new", model: "new-model" }]
  });
  assert.equal(merged.openai.apiKey, "openai-secret");
  assert.equal(merged.openai.model, "original");
  assert.equal(merged.deepseek.apiKey, "deepseek-secret");
  assert.equal(merged.deepseek.model, "next-model");
  assert.equal(merged.customProviders[0].apiKey, "b-secret");
  assert.equal(merged.customProviders[0].model, "b-model");
  assert.equal(merged.customProviders[1].apiKey, "");
  assert.equal(merged.activeCustomId, "b");
  assert.deepEqual(saved, before);
  assert.deepEqual(mergeAiSettings(saved), saved);
});

test("explicit credential and profile removal does not restore old values", () => {
  const saved = normalizeSettings({
    deepseek: { apiKey: "secret" },
    customProviders: [{ id: "a", apiKey: "a-secret" }]
  });
  const cleared = mergeAiSettings(saved, { deepseek: { apiKey: "" }, customProviders: [{ id: "a", apiKey: "" }] });
  assert.equal(cleared.deepseek.apiKey, "");
  assert.equal(cleared.customProviders[0].apiKey, "");
  const removed = mergeAiSettings(saved, { customProviders: [] });
  assert.deepEqual(removed.customProviders, []);
  assert.equal(removed.activeCustomId, "");
});

test("public AI settings contain only credential presence flags and independent default objects", () => {
  const saved = normalizeSettings({
    openai: { apiKey: "openai-secret" }, minimax: { apiKey: "minimax-secret" },
    deepseek: { apiKey: "deepseek-secret" }, customProviders: [{ id: "a", apiKey: "custom-secret" }]
  });
  const projected = publicAiSettings(saved);
  for (const item of [projected.openai, projected.minimax, projected.deepseek, ...projected.customProviders]) {
    assert.equal(item.hasApiKey, true);
    assert.equal(Object.hasOwn(item, "apiKey"), false);
  }
  assert.doesNotMatch(JSON.stringify(projected), /-secret/);
  projected.deepseek.model = "changed";
  assert.equal(saved.deepseek.model, "deepseek-flash");
  const defaults = normalizeSettings();
  defaults.deepseek.model = "changed";
  assert.equal(normalizeSettings().deepseek.model, "deepseek-flash");
  assert.equal(publicAiSettings(normalizeSettings()).deepseek.hasApiKey, false);
});
