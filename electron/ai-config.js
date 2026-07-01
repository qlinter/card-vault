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
  const legacyProvider = normalizeProvider(value.provider);

  return {
    provider: legacyProvider,
    azure: normalizeAzure({
      ...(value.azure || {}),
      endpoint: value.azure?.endpoint ?? (legacyProvider === "azure" ? value.endpoint : undefined),
      apiKey: value.azure?.apiKey ?? (legacyProvider === "azure" ? value.apiKey : undefined),
      deployment: value.azure?.deployment ?? value.deployment,
      apiVersion: value.azure?.apiVersion ?? value.apiVersion
    }),
    minimax: normalizeMiniMax({
      ...(value.minimax || {}),
      endpoint: value.minimax?.endpoint ?? (legacyProvider === "minimax" ? value.endpoint : undefined),
      apiKey: value.minimax?.apiKey ?? (legacyProvider === "minimax" ? value.apiKey : undefined),
      model: value.minimax?.model ?? value.model
    })
  };
}

function publicSettings(settings) {
  return {
    provider: settings.provider,
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

function createAiConfigManager(configPath) {
  function load() {
    try {
      return normalizeSettings(JSON.parse(fs.readFileSync(configPath, "utf8")));
    } catch {
      return normalizeSettings({});
    }
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

    fs.mkdirSync(path.dirname(configPath), { recursive: true });
    fs.writeFileSync(configPath, JSON.stringify(next, null, 2));
    return publicSettings(next);
  }

  return {
    getConfigPath: () => configPath,
    getPublicSettings: () => publicSettings(load()),
    save
  };
}

module.exports = {
  createAiConfigManager,
  defaultApiVersion
};
