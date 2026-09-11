const fs = require("node:fs");
const { writeJsonAtomic } = require("../lib/atomic-json");
const { normalizeProvider, normalizeSettings, publicAiSettings, mergeAiSettings } = require("../lib/ai-settings-core");

function publicSettings(settings, keyRecoveryRequired = false) {
  return { ...publicAiSettings(settings), keyRecoveryRequired };
}

function createAiConfigManager(configPath, cryptoAdapter = {}) {
  let decryptionFailed = false;

  function encryptionAvailable() {
    return typeof cryptoAdapter.isEncryptionAvailable === "function" && cryptoAdapter.isEncryptionAvailable();
  }

  function decryptKey(value) {
    if (!value) return "";
    if (!encryptionAvailable() || typeof cryptoAdapter.decryptString !== "function") {
      throw new Error("Windows 安全存储当前不可用，无法读取已加密的 AI API Key。");
    }
    try {
      return cryptoAdapter.decryptString(Buffer.from(value, "base64"));
    } catch {
      decryptionFailed = true;
      return "";
    }
  }

  function encryptKey(value) {
    if (!value) return "";
    if (!encryptionAvailable() || typeof cryptoAdapter.encryptString !== "function") {
      throw new Error("Windows 安全存储当前不可用，AI API Key 未保存。");
    }
    return cryptoAdapter.encryptString(value).toString("base64");
  }

  function readRaw() {
    try {
      return JSON.parse(fs.readFileSync(configPath, "utf8"));
    } catch {
      return {};
    }
  }

  function load() {
    decryptionFailed = false;
    const raw = readRaw();
    const provider = normalizeProvider(raw.provider);
    const azureRaw = raw.azure || {};
    const minimaxRaw = raw.minimax || {};
    const deepseekRaw = raw.deepseek || {};
    if (fs.existsSync(configPath) && raw.version !== 5) throw new Error("AI 配置格式不受支持，仅接受当前版本配置。");
    const customRawItems = Array.isArray(raw.customProviders) ? raw.customProviders : [];
    return normalizeSettings({
      provider,
      activeCustomId: raw.activeCustomId,
      azure: {
        endpoint: azureRaw.endpoint,
        apiKey: azureRaw.apiKeyEncrypted ? decryptKey(azureRaw.apiKeyEncrypted) : "",
        deployment: azureRaw.deployment
      },
      minimax: {
        endpoint: minimaxRaw.endpoint,
        apiKey: minimaxRaw.apiKeyEncrypted ? decryptKey(minimaxRaw.apiKeyEncrypted) : "",
        model: minimaxRaw.model
      },
      deepseek: {
        endpoint: deepseekRaw.endpoint,
        apiKey: deepseekRaw.apiKeyEncrypted ? decryptKey(deepseekRaw.apiKeyEncrypted) : "",
        model: deepseekRaw.model
      },
      customProviders: customRawItems.map((item) => ({
        ...item,
        apiKey: item.apiKeyEncrypted ? decryptKey(item.apiKeyEncrypted) : ""
      }))
    });
  }

  function writeEncrypted(settings) {
    const stored = {
      version: 5,
      provider: settings.provider,
      activeCustomId: settings.activeCustomId,
      azure: {
        endpoint: settings.azure.endpoint,
        apiKeyEncrypted: encryptKey(settings.azure.apiKey),
        deployment: settings.azure.deployment
      },
      minimax: {
        endpoint: settings.minimax.endpoint,
        apiKeyEncrypted: encryptKey(settings.minimax.apiKey),
        model: settings.minimax.model
      },
      deepseek: {
        endpoint: settings.deepseek.endpoint,
        apiKeyEncrypted: encryptKey(settings.deepseek.apiKey),
        model: settings.deepseek.model
      },
      customProviders: settings.customProviders.map(({ apiKey, ...item }) => ({
        ...item,
        apiKeyEncrypted: encryptKey(apiKey)
      }))
    };
    writeJsonAtomic(configPath, stored);
  }

  function save(value) {
    const current = load();
    const next = mergeAiSettings(current, value);
    writeEncrypted(next);
    return publicSettings(next, false);
  }

  function getRuntimeEnv() {
    const settings = load();
    const activeCustom = settings.customProviders.find((item) => item.id === settings.activeCustomId) || settings.customProviders[0];
    return {
      CARD_VAULT_AI_PROVIDER: settings.provider,
      AZURE_OPENAI_ENDPOINT: settings.azure.endpoint,
      AZURE_OPENAI_API_KEY: settings.azure.apiKey,
      AZURE_OPENAI_DEPLOYMENT: settings.azure.deployment,
      MINIMAX_API_ENDPOINT: settings.minimax.endpoint,
      MINIMAX_API_KEY: settings.minimax.apiKey,
      MINIMAX_MODEL: settings.minimax.model,
      DEEPSEEK_API_ENDPOINT: settings.deepseek.endpoint,
      DEEPSEEK_API_KEY: settings.deepseek.apiKey,
      DEEPSEEK_MODEL: settings.deepseek.model,
      CARD_VAULT_CUSTOM_AI_ACTIVE_ID: settings.activeCustomId,
      CARD_VAULT_CUSTOM_AI_PROFILES_JSON: JSON.stringify(settings.customProviders),
      CARD_VAULT_CUSTOM_AI_NAME: activeCustom?.name || "",
      CARD_VAULT_CUSTOM_AI_ENDPOINT: activeCustom?.endpoint || "",
      CARD_VAULT_CUSTOM_AI_MODELS_ENDPOINT: activeCustom?.modelsEndpoint || "",
      CARD_VAULT_CUSTOM_AI_API_KEY: activeCustom?.apiKey || "",
      CARD_VAULT_CUSTOM_AI_MODEL: activeCustom?.model || "",
      CARD_VAULT_CUSTOM_AI_API_KEY_HEADER: activeCustom?.apiKeyHeader || "Authorization",
      CARD_VAULT_CUSTOM_AI_API_KEY_PREFIX: activeCustom?.apiKeyPrefix ?? "Bearer"
    };
  }

  function getPublicSettings() {
    return publicSettings(load(), decryptionFailed);
  }

  return {
    getConfigPath: () => configPath,
    getPublicSettings,
    getRuntimeEnv,
    save
  };
}

module.exports = { createAiConfigManager };
