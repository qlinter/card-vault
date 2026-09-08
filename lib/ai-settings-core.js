const defaultMiniMaxEndpoint = "https://api.minimax.io/v1/chat/completions";
const defaultMiniMaxModel = "MiniMax-VL-01";

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeEndpoint(value) {
  return text(value).replace(/\/+$/, "");
}

function normalizeProvider(value) {
  return value === "minimax" || value === "custom" ? value : "azure";
}

function normalizeAzure(value = {}) {
  return {
    endpoint: normalizeEndpoint(value?.endpoint),
    apiKey: text(value?.apiKey),
    deployment: text(value?.deployment)
  };
}

function normalizeMiniMax(value = {}) {
  return {
    endpoint: normalizeEndpoint(value?.endpoint || defaultMiniMaxEndpoint),
    apiKey: text(value?.apiKey),
    model: text(value?.model) || defaultMiniMaxModel
  };
}

function normalizeCustom(value = {}, fallbackId = "custom-1") {
  return {
    id: text(value?.id) || fallbackId,
    name: text(value?.name) || "未命名配置",
    endpoint: normalizeEndpoint(value?.endpoint),
    modelsEndpoint: normalizeEndpoint(value?.modelsEndpoint),
    apiKey: text(value?.apiKey),
    model: text(value?.model),
    apiKeyHeader: text(value?.apiKeyHeader) || "Authorization",
    apiKeyPrefix: value?.apiKeyPrefix === undefined ? "Bearer" : text(value.apiKeyPrefix)
  };
}

function normalizeCustomProviders(values = []) {
  const usedIds = new Set();
  return (Array.isArray(values) ? values : []).map((value, index) => {
    const normalized = normalizeCustom(value, `custom-${index + 1}`);
    let id = normalized.id;
    let suffix = 2;
    while (usedIds.has(id)) {
      id = `${normalized.id}-${suffix}`;
      suffix += 1;
    }
    usedIds.add(id);
    return { ...normalized, id };
  });
}

function normalizeSettings(value = {}) {
  const provider = normalizeProvider(value?.provider);
  const customProviders = normalizeCustomProviders(value?.customProviders);
  const requestedActiveId = text(value?.activeCustomId);
  const activeCustomId = customProviders.some((item) => item.id === requestedActiveId)
    ? requestedActiveId
    : customProviders[0]?.id || "";

  return {
    provider,
    activeCustomId,
    azure: normalizeAzure(value?.azure),
    minimax: normalizeMiniMax(value?.minimax),
    customProviders
  };
}

module.exports = {
  normalizeAzure,
  normalizeCustom,
  normalizeCustomProviders,
  normalizeEndpoint,
  normalizeMiniMax,
  normalizeProvider,
  normalizeSettings
};
