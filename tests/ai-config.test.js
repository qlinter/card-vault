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

test("AI settings encrypt API keys at rest and expose them only to the runtime environment", (t) => {
  const { configPath, manager } = testConfig(t);
  const saved = manager.save({
    provider: "azure",
    azure: { endpoint: "https://example.test", apiKey: "azure-secret", deployment: "vision", apiVersion: "2024-01-01" },
    minimax: { endpoint: "https://minimax.test", apiKey: "minimax-secret", model: "vision-model" }
  });

  const raw = fs.readFileSync(configPath, "utf8");
  const runtime = manager.getRuntimeEnv();
  assert.equal(saved.azure.hasApiKey, true);
  assert.equal(saved.minimax.hasApiKey, true);
  assert.equal(raw.includes("azure-secret"), false);
  assert.equal(raw.includes("minimax-secret"), false);
  assert.equal(JSON.parse(raw).version, 2);
  assert.equal(runtime.AZURE_OPENAI_API_KEY, "azure-secret");
  assert.equal(runtime.MINIMAX_API_KEY, "minimax-secret");
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
    version: 2,
    provider: "azure",
    azure: {
      endpoint: "https://example.test",
      apiKeyEncrypted: "invalid-encrypted-value",
      deployment: "vision",
      apiVersion: "2024-01-01"
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
