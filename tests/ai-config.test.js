const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { createAiConfigManager } = require("../electron/ai-config");

function testConfig(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "card-vault-ai-config-test-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const configPath = path.join(root, "ai-config.json");
  const cryptoAdapter = {
    isEncryptionAvailable: () => true,
    encryptString: (value) => Buffer.from(`encrypted:${value}`, "utf8"),
    decryptString: (value) => value.toString("utf8").replace(/^encrypted:/, "")
  };
  return { configPath, manager: createAiConfigManager(configPath, cryptoAdapter) };
}

test("version 2 AI settings migrate to v5 without the legacy API version", (t) => {
  const { configPath, manager } = testConfig(t);
  fs.writeFileSync(configPath, JSON.stringify({
    version: 2,
    provider: "azure",
    azure: {
      endpoint: "https://example.openai.azure.com",
      apiKeyEncrypted: Buffer.from("encrypted:azure-secret").toString("base64"),
      deployment: "gpt-5.4",
      apiVersion: "2024-02-15-preview"
    },
    minimax: { endpoint: "https://minimax.test", apiKeyEncrypted: "", model: "model-a" }
  }));

  assert.equal(manager.migrateLegacyConfig(), true);
  const stored = JSON.parse(fs.readFileSync(configPath, "utf8"));
  const runtime = manager.getRuntimeEnv();
  assert.equal(stored.version, 5);
  assert.equal("apiVersion" in stored.azure, false);
  assert.equal(runtime.AZURE_OPENAI_API_VERSION, undefined);
  assert.equal(runtime.AZURE_OPENAI_API_KEY, "azure-secret");
});

test("AI settings encrypt API keys at rest and expose them only to the runtime environment", (t) => {
  const { configPath, manager } = testConfig(t);
  const saved = manager.save({
    provider: "custom",
    activeCustomId: "custom-cloud",
    azure: { endpoint: "https://example.test", apiKey: "azure-secret", deployment: "vision" },
    minimax: { endpoint: "https://minimax.test", apiKey: "minimax-secret", model: "vision-model" },
    customProviders: [
      {
        id: "custom-local",
        name: "Local Vision",
        endpoint: "http://127.0.0.1:1234/v1/chat/completions",
        modelsEndpoint: "http://127.0.0.1:1234/v1/models",
        apiKey: "local-secret",
        model: "local-vision",
        apiKeyHeader: "Authorization",
        apiKeyPrefix: "Bearer"
      },
      {
        id: "custom-cloud",
        name: "Cloud Vision",
        endpoint: "https://cloud.test/v1/chat/completions",
        modelsEndpoint: "https://cloud.test/v1/models",
        apiKey: "cloud-secret",
        model: "cloud-vision",
        apiKeyHeader: "X-API-Key",
        apiKeyPrefix: ""
      }
    ]
  });

  const raw = fs.readFileSync(configPath, "utf8");
  const runtime = manager.getRuntimeEnv();
  assert.equal(saved.azure.hasApiKey, true);
  assert.equal(saved.minimax.hasApiKey, true);
  assert.equal(saved.customProviders.length, 2);
  assert.equal(saved.customProviders.every((item) => item.hasApiKey), true);
  assert.equal(raw.includes("azure-secret"), false);
  assert.equal(raw.includes("minimax-secret"), false);
  assert.equal(raw.includes("local-secret"), false);
  assert.equal(raw.includes("cloud-secret"), false);
  assert.equal(JSON.parse(raw).version, 5);
  assert.equal(runtime.AZURE_OPENAI_API_KEY, "azure-secret");
  assert.equal(runtime.MINIMAX_API_KEY, "minimax-secret");
  assert.equal(runtime.CARD_VAULT_CUSTOM_AI_API_KEY, "cloud-secret");
  assert.equal(runtime.CARD_VAULT_CUSTOM_AI_API_KEY_HEADER, "X-API-Key");
  const runtimeProfiles = JSON.parse(runtime.CARD_VAULT_CUSTOM_AI_PROFILES_JSON);
  assert.deepEqual(runtimeProfiles.map((item) => item.name), ["Local Vision", "Cloud Vision"]);
});

test("version 4 single custom AI settings migrate to a named v5 profile", (t) => {
  const { configPath, manager } = testConfig(t);
  fs.writeFileSync(configPath, JSON.stringify({
    version: 4,
    provider: "custom",
    azure: { endpoint: "", apiKeyEncrypted: "", deployment: "" },
    minimax: { endpoint: "https://minimax.test", apiKeyEncrypted: "", model: "model-a" },
    custom: {
      name: "Legacy Gateway",
      endpoint: "https://legacy.test/v1/chat/completions",
      modelsEndpoint: "https://legacy.test/v1/models",
      apiKeyEncrypted: Buffer.from("encrypted:legacy-secret").toString("base64"),
      model: "legacy-vision",
      apiKeyHeader: "Authorization",
      apiKeyPrefix: "Bearer"
    }
  }));

  assert.equal(manager.migrateLegacyConfig(), true);
  const stored = JSON.parse(fs.readFileSync(configPath, "utf8"));
  const settings = manager.getPublicSettings();
  assert.equal(stored.version, 5);
  assert.equal(settings.activeCustomId, "custom-legacy");
  assert.equal(settings.customProviders[0].name, "Legacy Gateway");
  assert.equal(settings.customProviders[0].hasApiKey, true);
  assert.equal(manager.getRuntimeEnv().CARD_VAULT_CUSTOM_AI_API_KEY, "legacy-secret");
});

test("legacy plaintext AI settings are migrated without losing provider configuration", (t) => {
  const { configPath, manager } = testConfig(t);
  fs.writeFileSync(configPath, JSON.stringify({
    provider: "minimax",
    azure: { endpoint: "https://azure.test", apiKey: "old-azure", deployment: "deployment" },
    minimax: { endpoint: "https://minimax.test", apiKey: "old-minimax", model: "model-a" }
  }));

  assert.equal(manager.migrateLegacyConfig(), true);
  const raw = fs.readFileSync(configPath, "utf8");
  const runtime = manager.getRuntimeEnv();
  assert.equal(raw.includes("old-azure"), false);
  assert.equal(raw.includes("old-minimax"), false);
  assert.equal(runtime.CARD_VAULT_AI_PROVIDER, "minimax");
  assert.equal(runtime.MINIMAX_MODEL, "model-a");
  assert.equal(manager.migrateLegacyConfig(), false);
});

test("undecryptable API keys do not prevent desktop startup or settings recovery", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "card-vault-ai-public-test-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const configPath = path.join(root, "ai-config.json");
  fs.writeFileSync(configPath, JSON.stringify({
    version: 3,
    provider: "azure",
    azure: {
      endpoint: "https://example.test",
      apiKeyEncrypted: "invalid-encrypted-value",
      deployment: "vision"
    },
    minimax: { endpoint: "https://minimax.test", apiKeyEncrypted: "", model: "model-a" }
  }));
  const manager = createAiConfigManager(configPath, {
    isEncryptionAvailable: () => true,
    decryptString: () => {
      throw new Error("decrypt should not be called");
    }
  });

  const settings = manager.getPublicSettings();
  const runtime = manager.getRuntimeEnv();
  assert.equal(settings.azure.hasApiKey, false);
  assert.equal(settings.azure.endpoint, "https://example.test");
  assert.equal(settings.keyRecoveryRequired, true);
  assert.equal(runtime.AZURE_OPENAI_API_KEY, "");
});
