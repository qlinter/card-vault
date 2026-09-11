const builtInAiProviders = Object.freeze({
  azure: Object.freeze({ name: "Azure OpenAI", endpoint: "", model: "", modelField: "deployment" }),
  minimax: Object.freeze({ name: "MiniMax", endpoint: "https://api.minimax.io/v1/chat/completions", model: "MiniMax-VL-01", modelField: "model" }),
  deepseek: Object.freeze({ name: "DeepSeek", endpoint: "https://api.deepseek.com/chat/completions", model: "deepseek-flash", modelField: "model" })
});

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeEndpoint(value) {
  return text(value).replace(/\/+$/, "");
}

function normalizeProvider(value) {
  return value === "deepseek" || value === "minimax" || value === "custom" ? value : "azure";
}

function normalizeBuiltIn(provider, value = {}) {
  const defaults = builtInAiProviders[provider];
  return {
    endpoint: normalizeEndpoint(value?.endpoint || defaults.endpoint),
    apiKey: text(value?.apiKey),
    [defaults.modelField]: text(value?.[defaults.modelField]) || defaults.model
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
    azure: normalizeBuiltIn("azure", value?.azure),
    minimax: normalizeBuiltIn("minimax", value?.minimax),
    deepseek: normalizeBuiltIn("deepseek", value?.deepseek),
    customProviders
  };
}

function publicAiSettings(settings) {
  const redact = ({ apiKey, ...fields }) => ({ ...fields, hasApiKey: Boolean(apiKey) });
  return {
    provider: settings.provider,
    activeCustomId: settings.activeCustomId,
    ...Object.fromEntries(Object.keys(builtInAiProviders).map(provider => [provider, redact(settings[provider])])),
    customProviders: settings.customProviders.map(redact)
  };
}

// Undefined means unchanged; an explicit empty key clears the saved credential.
function mergeAiSettings(current, draft = {}) {
  const mergeDefined = (saved, patch) => ({ ...saved, ...Object.fromEntries(Object.entries(patch || {}).filter(([, value]) => value !== undefined)) });
  const customById = new Map(current.customProviders.map(item => [item.id, item]));
  return normalizeSettings({
    provider: draft.provider ?? current.provider,
    activeCustomId: draft.activeCustomId ?? current.activeCustomId,
    ...Object.fromEntries(Object.keys(builtInAiProviders).map(provider => [provider, mergeDefined(current[provider], draft[provider])])),
    customProviders: Array.isArray(draft.customProviders)
      ? draft.customProviders.map(item => mergeDefined(customById.get(item.id), item))
      : current.customProviders
  });
}

module.exports = {
  builtInAiProviders,
  publicAiSettings,
  mergeAiSettings,
  normalizeCustom,
  normalizeCustomProviders,
  normalizeEndpoint,
  normalizeProvider,
  normalizeSettings
};
