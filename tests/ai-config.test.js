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

test("encrypted version-5 Azure settings migrate to a custom profile and remain encrypted on save", t => {
  const { configPath, manager } = testConfig(t);
  fs.writeFileSync(configPath, JSON.stringify({ version: 5, provider: "azure", azure: { endpoint: "https://resource.openai.azure.com", deployment: "vision", apiKeyEncrypted: Buffer.from("encrypted:legacy-key").toString("base64") }, minimax: { model: "MiniMax-VL-01" }, deepseek: { model: "deepseek-flash" } }));
  const before = fs.readFileSync(configPath, "utf8");
  const settings = manager.getPublicSettings();
  assert.equal(settings.provider, "custom");
  assert.equal(settings.customProviders[0].hasApiKey, true);
  assert.equal(settings.openai.hasApiKey, false);
  assert.equal(manager.getRuntimeEnv().CARD_VAULT_CUSTOM_AI_API_KEY, "legacy-key");
  assert.equal(manager.getRuntimeEnv().OPENAI_API_KEY, "");
  assert.equal(fs.readFileSync(configPath, "utf8"), before);
  manager.save({ provider: "openai", openai: { apiKey: "official-key" } });
  const stored = fs.readFileSync(configPath, "utf8");
  assert.equal(JSON.parse(stored).azure, undefined);
  assert.doesNotMatch(stored, /legacy-key|official-key/);
  assert.equal(manager.getRuntimeEnv().OPENAI_API_KEY, "official-key");
  assert.equal(manager.getRuntimeEnv().CARD_VAULT_CUSTOM_AI_API_KEY, "legacy-key");
  assert.equal(manager.getPublicSettings().customProviders.length, 1);
});

test("unsupported AI configuration is rejected without rewriting the file", t => {
  const { configPath, manager } = testConfig(t);
  for (const version of [undefined, 2, 3, 4, 6]) {
    const raw = JSON.stringify({ version, provider: "openai", endpoint: "https://old.example", apiKey: "old-key" });
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
    openai: { endpoint: "https://example.test", apiKey: "openai-secret", model: "vision" },
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
  assert.equal(saved.openai.hasApiKey, true);
  assert.equal(saved.minimax.hasApiKey, true);
  assert.equal(saved.customProviders.length, 2);
  assert.equal(saved.customProviders.every((item) => item.hasApiKey), true);
  assert.equal(raw.includes("openai-secret"), false);
  assert.equal(raw.includes("minimax-secret"), false);
  assert.equal(raw.includes("local-secret"), false);
  assert.equal(raw.includes("cloud-secret"), false);
  assert.equal(JSON.parse(raw).version, 5);
  assert.equal(runtime.OPENAI_API_KEY, "openai-secret");
  assert.equal(runtime.MINIMAX_API_KEY, "minimax-secret");
  assert.equal(runtime.CARD_VAULT_CUSTOM_AI_API_KEY, "cloud-secret");
  assert.equal(runtime.CARD_VAULT_CUSTOM_AI_API_KEY_HEADER, "X-API-Key");
  const runtimeProfiles = JSON.parse(runtime.CARD_VAULT_CUSTOM_AI_PROFILES_JSON);
  assert.deepEqual(runtimeProfiles.map((item) => item.name), ["Local Vision", "Cloud Vision"]);
});

test("DeepSeek preserves version-5 providers and encrypts its key across partial saves", (t) => {
  const { configPath, manager } = testConfig(t);
  manager.save({ provider: "openai", openai: { endpoint: "https://openai.test", model: "vision", apiKey: "openai-key" } });
  const legacy = JSON.parse(fs.readFileSync(configPath, "utf8"));
  delete legacy.deepseek;
  fs.writeFileSync(configPath, JSON.stringify(legacy));
  assert.equal(manager.getPublicSettings().deepseek.model, "deepseek-flash");
  manager.save({ provider: "deepseek", deepseek: { apiKey: "deepseek-secret" } });
  manager.save({ deepseek: { model: "deepseek-flash" } });
  const saved = manager.getPublicSettings();
  const runtime = manager.getRuntimeEnv();
  assert.equal(saved.provider, "deepseek");
  assert.equal(saved.deepseek.hasApiKey, true);
  assert.equal(runtime.DEEPSEEK_API_KEY, "deepseek-secret");
  assert.equal(runtime.DEEPSEEK_API_ENDPOINT, "https://api.deepseek.com/chat/completions");
  assert.equal(runtime.OPENAI_API_KEY, "openai-key");
  assert.equal(runtime.OPENAI_MODEL, "vision");
  assert.equal(runtime.OPENAI_API_ENDPOINT, "https://openai.test");
  assert.equal(JSON.stringify(saved).includes("deepseek-secret"), false);
  assert.equal(fs.readFileSync(configPath, "utf8").includes("deepseek-secret"), false);
  manager.save({ deepseek: { apiKey: "" } });
  assert.equal(manager.getPublicSettings().deepseek.hasApiKey, false);
});



test("undecryptable API keys do not prevent desktop startup or settings recovery", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "card-vault-ai-public-test-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const configPath = path.join(root, "ai-config.json");
  fs.writeFileSync(configPath, JSON.stringify({
    version: 5,
    provider: "openai",
    openai: {
      endpoint: "https://example.test",
      apiKeyEncrypted: "invalid-encrypted-value",
      model: "vision"
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
  assert.equal(settings.openai.hasApiKey, false);
  assert.equal(settings.openai.endpoint, "https://example.test");
  assert.equal(settings.keyRecoveryRequired, true);
  assert.equal(runtime.OPENAI_API_KEY, "");
});

test("proxy passwords stay encrypted and survive provider and mode changes", t => {
  const { configPath, manager } = testConfig(t);
  const saved = manager.save({ proxy: { mode: "manual", protocol: "socks5", host: "gateway.example.com", port: "1091", username: "collector", password: "proxy-secret" } });
  assert.equal(saved.proxy.hasPassword, true);
  assert.equal(Object.hasOwn(saved.proxy, "password"), false);
  assert.equal(fs.readFileSync(configPath, "utf8").includes("proxy-secret"), false);
  manager.save({ provider: "deepseek", proxy: { mode: "auto", password: undefined } });
  assert.equal(JSON.parse(manager.getRuntimeEnv().CARD_VAULT_AI_PROXY_JSON).password, "proxy-secret");
  manager.save({ proxy: { password: "" } });
  assert.equal(manager.getPublicSettings().proxy.hasPassword, false);
});

test("unreadable credentials survive unrelated saves and can be replaced or cleared explicitly", t => {
  const { configPath, manager } = testConfig(t);
  manager.save({ openai: { apiKey: "old-test-key" }, minimax: { apiKey: "other-test-key" }, proxy: { password: "old-test-password" }, customProviders: [{ id: "saved", endpoint: "https://custom.test", apiKey: "custom-test-key" }] });
  const before = JSON.parse(fs.readFileSync(configPath, "utf8"));
  const broken = createAiConfigManager(configPath, { isEncryptionAvailable: () => true, decryptString: () => { throw new Error("temporary failure"); }, encryptString: value => Buffer.from(`encrypted:${value}`) });
  assert.equal(broken.save({ proxy: { mode: "direct" } }).keyRecoveryRequired, true);
  const retained = JSON.parse(fs.readFileSync(configPath, "utf8"));
  assert.equal(retained.openai.apiKeyEncrypted, before.openai.apiKeyEncrypted);
  assert.equal(retained.minimax.apiKeyEncrypted, before.minimax.apiKeyEncrypted);
  assert.equal(retained.proxy.passwordEncrypted, before.proxy.passwordEncrypted);
  assert.equal(retained.customProviders[0].apiKeyEncrypted, before.customProviders[0].apiKeyEncrypted);
  assert.equal(manager.getRuntimeEnv().OPENAI_API_KEY, "old-test-key");
  broken.save({ openai: { apiKey: "replacement-test-key" }, proxy: { password: "" }, customProviders: [{ id: "saved", apiKey: "" }] });
  assert.equal(manager.getRuntimeEnv().OPENAI_API_KEY, "replacement-test-key");
  assert.equal(manager.getPublicSettings().proxy.hasPassword, false);
  assert.equal(manager.getPublicSettings().customProviders[0].hasApiKey, false);
  assert.equal(manager.getRuntimeEnv().MINIMAX_API_KEY, "other-test-key");
  const unavailable = createAiConfigManager(configPath, { isEncryptionAvailable: () => false });
  unavailable.save({ provider: "deepseek" });
  assert.equal(manager.getRuntimeEnv().OPENAI_API_KEY, "replacement-test-key");
});

test("unreadable legacy Azure credentials migrate without losing their original ciphertext", t => {
  const { configPath } = testConfig(t);
  fs.writeFileSync(configPath, JSON.stringify({ version: 5, provider: "azure", azure: { endpoint: "https://legacy.test", deployment: "vision", apiKeyEncrypted: Buffer.from("encrypted:azure-test-key").toString("base64") } }));
  const broken = createAiConfigManager(configPath, { isEncryptionAvailable: () => false });
  const saved = broken.save({ proxy: { mode: "direct" } });
  assert.equal(saved.keyRecoveryRequired, true);
  const restored = createAiConfigManager(configPath, { isEncryptionAvailable: () => true, decryptString: value => value.toString().replace(/^encrypted:/, "") });
  assert.equal(restored.getRuntimeEnv().CARD_VAULT_CUSTOM_AI_API_KEY, "azure-test-key");
  // A partially configured legacy provider can contain only a saved key.
  fs.writeFileSync(configPath, JSON.stringify({ version: 5, azure: { apiKeyEncrypted: Buffer.from("encrypted:key-only-test").toString("base64") } }));
  broken.save({ proxy: { mode: "direct" } });
  assert.equal(restored.getRuntimeEnv().CARD_VAULT_CUSTOM_AI_PROFILES_JSON.includes("key-only-test"), true);
});
