const { normalizeAiProxy } = require("./ai-proxy-core");
const builtInAiProviders = Object.freeze({
  openai: Object.freeze({ name: "OpenAI", endpoint: "https://api.openai.com/v1/chat/completions", model: "gpt-5.4-mini" }),
  minimax: Object.freeze({ name: "MiniMax", endpoint: "https://api.minimax.io/v1/chat/completions", model: "MiniMax-VL-01" }),
  deepseek: Object.freeze({ name: "DeepSeek", endpoint: "https://api.deepseek.com/chat/completions", model: "deepseek-flash" })
});

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeEndpoint(value) {
  return text(value).replace(/\/+$/, "");
}

function normalizeProvider(value) {
  return value === "deepseek" || value === "minimax" || value === "custom" ? value : "openai";
}

function normalizeBuiltIn(provider, value = {}) {
  const defaults = builtInAiProviders[provider];
  return {
    endpoint: normalizeEndpoint(value?.endpoint || defaults.endpoint),
    apiKey: text(value?.apiKey),
    model: text(value?.model) || defaults.model
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
  const customProviders = normalizeCustomProviders(value?.customProviders);
  // Preserve existing Azure credentials under their original host, never under OpenAI.
  const azure = value?.azure;
  let legacyId;
  if (azure && [azure.endpoint, azure.deployment, azure.apiKey].some(text)) {
    legacyId = "legacy-azure";
    while (customProviders.some(item => item.id === legacyId)) legacyId += "-2";
    const endpoint = normalizeEndpoint(azure.endpoint);
    const base = endpoint.match(/^(.*\/openai\/v1)(?:\/(?:chat\/completions|responses|models))?$/i)?.[1] || `${endpoint}/openai/v1`;
    customProviders.push(normalizeCustom({ id: legacyId, name: "Azure OpenAI", endpoint: endpoint ? `${base}/chat/completions` : "", model: azure.deployment, apiKey: azure.apiKey, apiKeyHeader: "api-key", apiKeyPrefix: "" }));
  }
  const provider = value?.provider === "azure" && legacyId ? "custom" : normalizeProvider(value?.provider);
  const requestedActiveId = value?.provider === "azure" && legacyId ? legacyId : text(value?.activeCustomId);
  const activeCustomId = customProviders.some((item) => item.id === requestedActiveId)
    ? requestedActiveId
    : customProviders[0]?.id || "";

  return {
    provider,
    activeCustomId,
    proxy: normalizeAiProxy(value?.proxy),
    openai: normalizeBuiltIn("openai", value?.openai),
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
    proxy: (({ password, ...fields }) => ({ ...fields, hasPassword: Boolean(password) }))(settings.proxy),
    ...Object.fromEntries(Object.keys(builtInAiProviders).map(provider => [provider, redact(settings[provider])])),
    customProviders: settings.customProviders.map(redact)
  };
}

// Undefined means unchanged; an explicit empty key clears the saved credential.
function mergeAiSettings(current, draft = {}) {
  const mergeDefined = (saved, patch) => ({ ...saved, ...Object.fromEntries(Object.entries(patch || {}).filter(([, value]) => value !== undefined)) });
  const customById = new Map(current.customProviders.map(item => [item.id, item]));
  return normalizeSettings({
    proxy: mergeDefined(current.proxy, draft.proxy),
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
