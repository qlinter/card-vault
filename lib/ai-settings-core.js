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

function hasLegacyCustom(value, provider) {
  const custom = value?.custom;
  return Boolean(provider === "custom" || custom?.endpoint || custom?.model || custom?.apiKey || custom?.name);
}

function normalizeSettings(value = {}) {
  const provider = normalizeProvider(value?.provider);
  const customProviders = normalizeCustomProviders(
    Array.isArray(value?.customProviders)
      ? value.customProviders
      : hasLegacyCustom(value, provider)
        ? [{
            ...(value.custom || {}),
            id: value.custom?.id || "custom-legacy",
            endpoint: value.custom?.endpoint ?? (provider === "custom" ? value.endpoint : undefined),
            apiKey: value.custom?.apiKey ?? (provider === "custom" ? value.apiKey : undefined),
            model: value.custom?.model ?? (provider === "custom" ? value.model : undefined)
          }]
        : []
  );
  const requestedActiveId = text(value?.activeCustomId);
  const activeCustomId = customProviders.some((item) => item.id === requestedActiveId)
    ? requestedActiveId
    : customProviders[0]?.id || "";

  return {
    provider,
    activeCustomId,
    azure: normalizeAzure({
      ...(value.azure || {}),
      endpoint: value.azure?.endpoint ?? (provider === "azure" ? value.endpoint : undefined),
      apiKey: value.azure?.apiKey ?? (provider === "azure" ? value.apiKey : undefined),
      deployment: value.azure?.deployment ?? value.deployment
    }),
    minimax: normalizeMiniMax({
      ...(value.minimax || {}),
      endpoint: value.minimax?.endpoint ?? (provider === "minimax" ? value.endpoint : undefined),
      apiKey: value.minimax?.apiKey ?? (provider === "minimax" ? value.apiKey : undefined),
      model: value.minimax?.model ?? (provider === "minimax" ? value.model : undefined)
    }),
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
