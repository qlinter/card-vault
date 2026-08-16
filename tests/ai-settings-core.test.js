const assert = require("node:assert/strict");
const test = require("node:test");
const { normalizeSettings } = require("../lib/ai-settings-core");

test("shared AI settings normalization applies consistent endpoints, defaults, and unique custom ids", () => {
  const settings = normalizeSettings({
    provider: "custom",
    activeCustomId: "same",
    azure: { endpoint: " https://azure.example/ ", deployment: " model " },
    minimax: {},
    customProviders: [
      { id: "same", name: " First ", endpoint: "https://first.example/v1/", model: "one" },
      { id: "same", name: "Second", endpoint: "https://second.example/v1/", model: "two" }
    ]
  });

  assert.equal(settings.azure.endpoint, "https://azure.example");
  assert.equal(settings.azure.deployment, "model");
  assert.equal(settings.minimax.endpoint, "https://api.minimax.io/v1/chat/completions");
  assert.equal(settings.minimax.model, "MiniMax-VL-01");
  assert.deepEqual(settings.customProviders.map((item) => item.id), ["same", "same-2"]);
  assert.equal(settings.customProviders[0].endpoint, "https://first.example/v1");
  assert.equal(settings.activeCustomId, "same");
});

test("shared AI settings normalization preserves legacy single-provider fields", () => {
  const settings = normalizeSettings({
    provider: "custom",
    endpoint: "https://legacy.example/v1/chat/completions",
    apiKey: "legacy-key",
    model: "legacy-model"
  });

  assert.equal(settings.customProviders.length, 1);
  assert.equal(settings.customProviders[0].endpoint, "https://legacy.example/v1/chat/completions");
  assert.equal(settings.customProviders[0].apiKey, "legacy-key");
  assert.equal(settings.customProviders[0].model, "legacy-model");
});
