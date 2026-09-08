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

test("unsupported AI configuration is rejected without rewriting the file", t => {
  const { configPath, manager } = testConfig(t);
  for (const version of [undefined, 2, 3, 4, 6]) {
    const raw = JSON.stringify({ version, provider: "azure", endpoint: "https://old.example", apiKey: "old-key" });
    fs.writeFileSync(configPath, raw);
    assert.throws(() => manager.getRuntimeEnv(), /配置格式不受支持/);
    assert.equal(fs.readFileSync(configPath, "utf8"), raw);
  }
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



test("undecryptable API keys do not prevent desktop startup or settings recovery", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "card-vault-ai-public-test-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const configPath = path.join(root, "ai-config.json");
  fs.writeFileSync(configPath, JSON.stringify({
    version: 5,
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
