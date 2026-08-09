const fs = require("node:fs");
const path = require("node:path");

const defaultApiVersion = "2024-02-15-preview";
const defaultMiniMaxEndpoint = "https://api.minimax.io/v1/chat/completions";
const defaultMiniMaxModel = "MiniMax-VL-01";

function normalizeProvider(value) {
  return value === "minimax" ? "minimax" : "azure";
}

function normalizeAzure(value = {}) {
  return {
    endpoint: typeof value.endpoint === "string" ? value.endpoint.trim() : "",
    apiKey: typeof value.apiKey === "string" ? value.apiKey.trim() : "",
    deployment: typeof value.deployment === "string" ? value.deployment.trim() : "",
    apiVersion: typeof value.apiVersion === "string" && value.apiVersion.trim() ? value.apiVersion.trim() : defaultApiVersion
  };
}

function normalizeMiniMax(value = {}) {
  return {
    endpoint: typeof value.endpoint === "string" && value.endpoint.trim() ? value.endpoint.trim() : defaultMiniMaxEndpoint,
    apiKey: typeof value.apiKey === "string" ? value.apiKey.trim() : "",
    model: typeof value.model === "string" && value.model.trim() ? value.model.trim() : defaultMiniMaxModel
  };
}

function normalizeSettings(value = {}) {
  const provider = normalizeProvider(value.provider);
  return {
    provider,
    azure: normalizeAzure(value.azure),
    minimax: normalizeMiniMax(value.minimax)
  };
}

function publicSettings(settings, keyRecoveryRequired = false) {
  return {
    provider: settings.provider,
    keyRecoveryRequired,
    azure: {
      endpoint: settings.azure.endpoint,
      deployment: settings.azure.deployment,
      apiVersion: settings.azure.apiVersion,
      hasApiKey: Boolean(settings.azure.apiKey)
    },
    minimax: {
      endpoint: settings.minimax.endpoint,
      model: settings.minimax.model,
      hasApiKey: Boolean(settings.minimax.apiKey)
    }
  };
}

function createAiConfigManager(configPath, cryptoAdapter = {}) {
  let decryptionFailed = false;

  function encryptionAvailable() {
    return typeof cryptoAdapter.isEncryptionAvailable === "function" && cryptoAdapter.isEncryptionAvailable();
  }

  function decryptKey(value) {
    if (!value) {
      return "";
    }
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
    if (!value) {
      return "";
    }
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
    return normalizeSettings({
      provider,
      azure: {
        endpoint: azureRaw.endpoint ?? (provider === "azure" ? raw.endpoint : undefined),
        apiKey: azureRaw.apiKeyEncrypted ? decryptKey(azureRaw.apiKeyEncrypted) : (azureRaw.apiKey ?? (provider === "azure" ? raw.apiKey : "")),
        deployment: azureRaw.deployment ?? raw.deployment,
        apiVersion: azureRaw.apiVersion ?? raw.apiVersion
      },
      minimax: {
        endpoint: minimaxRaw.endpoint ?? (provider === "minimax" ? raw.endpoint : undefined),
        apiKey: minimaxRaw.apiKeyEncrypted ? decryptKey(minimaxRaw.apiKeyEncrypted) : (minimaxRaw.apiKey ?? (provider === "minimax" ? raw.apiKey : "")),
        model: minimaxRaw.model ?? raw.model
      }
    });
  }

  function writeEncrypted(settings) {
    const stored = {
      version: 2,
      provider: settings.provider,
      azure: {
        endpoint: settings.azure.endpoint,
        apiKeyEncrypted: encryptKey(settings.azure.apiKey),
        deployment: settings.azure.deployment,
        apiVersion: settings.azure.apiVersion
      },
      minimax: {
        endpoint: settings.minimax.endpoint,
        apiKeyEncrypted: encryptKey(settings.minimax.apiKey),
        model: settings.minimax.model
      }
    };
    fs.mkdirSync(path.dirname(configPath), { recursive: true });
    fs.writeFileSync(configPath, JSON.stringify(stored, null, 2));
  }

  function save(value) {
    const current = load();
    const next = normalizeSettings({
      provider: value.provider,
      azure: {
        endpoint: value.azure?.endpoint,
        apiKey: value.azure?.apiKey === undefined ? current.azure.apiKey : value.azure.apiKey,
        deployment: value.azure?.deployment,
        apiVersion: value.azure?.apiVersion
      },
      minimax: {
        endpoint: value.minimax?.endpoint,
        apiKey: value.minimax?.apiKey === undefined ? current.minimax.apiKey : value.minimax.apiKey,
        model: value.minimax?.model
      }
    });
    writeEncrypted(next);
    return publicSettings(next, false);
  }

  function migrateLegacyConfig() {
    const raw = readRaw();
    if (!fs.existsSync(configPath) || raw.version === 2) {
      return false;
    }
    writeEncrypted(load());
    return true;
  }

  function getRuntimeEnv() {
    const settings = load();
    return {
      CARD_VAULT_AI_PROVIDER: settings.provider,
      AZURE_OPENAI_ENDPOINT: settings.azure.endpoint,
      AZURE_OPENAI_API_KEY: settings.azure.apiKey,
      AZURE_OPENAI_DEPLOYMENT: settings.azure.deployment,
      AZURE_OPENAI_API_VERSION: settings.azure.apiVersion,
      MINIMAX_API_ENDPOINT: settings.minimax.endpoint,
      MINIMAX_API_KEY: settings.minimax.apiKey,
      MINIMAX_MODEL: settings.minimax.model
    };
  }

  function getPublicSettings() {
    const settings = load();
    return publicSettings(settings, decryptionFailed);
  }

  return {
    getConfigPath: () => configPath,
    getPublicSettings,
    getRuntimeEnv,
    migrateLegacyConfig,
    save
  };
}

module.exports = {
  createAiConfigManager,
  defaultApiVersion
};
