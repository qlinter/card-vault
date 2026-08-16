const fs = require("node:fs");
const path = require("node:path");
const { normalizeProvider, normalizeSettings } = require("../lib/ai-settings-core");

function publicSettings(settings, keyRecoveryRequired = false) {
  return {
    provider: settings.provider,
    activeCustomId: settings.activeCustomId,
    keyRecoveryRequired,
    azure: {
      endpoint: settings.azure.endpoint,
      deployment: settings.azure.deployment,
      hasApiKey: Boolean(settings.azure.apiKey)
    },
    minimax: {
      endpoint: settings.minimax.endpoint,
      model: settings.minimax.model,
      hasApiKey: Boolean(settings.minimax.apiKey)
    },
    customProviders: settings.customProviders.map(({ apiKey, ...item }) => ({ ...item, hasApiKey: Boolean(apiKey) }))
  };
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
    const customRawItems = Array.isArray(raw.customProviders)
      ? raw.customProviders
      : raw.custom && (provider === "custom" || raw.custom.endpoint || raw.custom.model || raw.custom.apiKeyEncrypted || raw.custom.apiKey)
        ? [{ ...raw.custom, id: raw.custom.id || "custom-legacy" }]
        : [];
    return normalizeSettings({
      provider,
      activeCustomId: raw.activeCustomId,
      azure: {
        endpoint: azureRaw.endpoint ?? (provider === "azure" ? raw.endpoint : undefined),
        apiKey: azureRaw.apiKeyEncrypted ? decryptKey(azureRaw.apiKeyEncrypted) : (azureRaw.apiKey ?? (provider === "azure" ? raw.apiKey : "")),
        deployment: azureRaw.deployment ?? raw.deployment
      },
      minimax: {
        endpoint: minimaxRaw.endpoint ?? (provider === "minimax" ? raw.endpoint : undefined),
        apiKey: minimaxRaw.apiKeyEncrypted ? decryptKey(minimaxRaw.apiKeyEncrypted) : (minimaxRaw.apiKey ?? (provider === "minimax" ? raw.apiKey : "")),
        model: minimaxRaw.model ?? raw.model
      },
      customProviders: customRawItems.map((item) => ({
        ...item,
        apiKey: item.apiKeyEncrypted ? decryptKey(item.apiKeyEncrypted) : (item.apiKey ?? (provider === "custom" ? raw.apiKey : ""))
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
      customProviders: settings.customProviders.map(({ apiKey, ...item }) => ({
        ...item,
        apiKeyEncrypted: encryptKey(apiKey)
      }))
    };
    fs.mkdirSync(path.dirname(configPath), { recursive: true });
    fs.writeFileSync(configPath, JSON.stringify(stored, null, 2));
  }

  function save(value) {
    const current = load();
    const currentCustomById = new Map(current.customProviders.map((item) => [item.id, item]));
    const requestedCustomProviders = Array.isArray(value.customProviders) ? value.customProviders : current.customProviders;
    const next = normalizeSettings({
      provider: value.provider,
      activeCustomId: value.activeCustomId,
      azure: {
        endpoint: value.azure?.endpoint,
        apiKey: value.azure?.apiKey === undefined ? current.azure.apiKey : value.azure.apiKey,
        deployment: value.azure?.deployment
      },
      minimax: {
        endpoint: value.minimax?.endpoint,
        apiKey: value.minimax?.apiKey === undefined ? current.minimax.apiKey : value.minimax.apiKey,
        model: value.minimax?.model
      },
      customProviders: requestedCustomProviders.map((item) => ({
        ...item,
        apiKey: item.apiKey === undefined ? currentCustomById.get(item.id)?.apiKey || "" : item.apiKey
      }))
    });
    writeEncrypted(next);
    return publicSettings(next, false);
  }

  function migrateLegacyConfig() {
    const raw = readRaw();
    if (!fs.existsSync(configPath) || raw.version === 5) return false;
    writeEncrypted(load());
    return true;
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
    migrateLegacyConfig,
    save
  };
}

module.exports = { createAiConfigManager };
