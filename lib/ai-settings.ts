import fs from "fs";
import { normalizeCustom, normalizeCustomProviders, normalizeEndpoint, normalizeProvider, normalizeSettings } from "./ai-settings-core.js";

export type AiProvider = "azure" | "minimax" | "custom";

export type AzureProviderSettings = {
  endpoint: string;
  apiKey: string;
  deployment: string;
};

export type MiniMaxProviderSettings = {
  endpoint: string;
  apiKey: string;
  model: string;
};

export type CustomProviderSettings = {
  id: string;
  name: string;
  endpoint: string;
  modelsEndpoint: string;
  apiKey: string;
  model: string;
  apiKeyHeader: string;
  apiKeyPrefix: string;
};

export type AiSettingsFile = {
  provider: AiProvider;
  activeCustomId: string;
  azure: AzureProviderSettings;
  minimax: MiniMaxProviderSettings;
  customProviders: CustomProviderSettings[];
};

export type ActiveAiSettings =
  | ({ provider: "azure" } & AzureProviderSettings)
  | ({ provider: "minimax" } & MiniMaxProviderSettings)
  | ({ provider: "custom" } & CustomProviderSettings);

export type PublicCustomProviderSettings = Omit<CustomProviderSettings, "apiKey"> & { hasApiKey: boolean };

export type PublicAiSettings = {
  provider: AiProvider;
  activeCustomId: string;
  azure: Omit<AzureProviderSettings, "apiKey"> & { hasApiKey: boolean };
  minimax: Omit<MiniMaxProviderSettings, "apiKey"> & { hasApiKey: boolean };
  customProviders: PublicCustomProviderSettings[];
};

export type AiSettingsDraft = {
  provider?: AiProvider;
  activeCustomId?: string;
  azure?: Partial<AzureProviderSettings>;
  minimax?: Partial<MiniMaxProviderSettings>;
  customProviders?: Array<Partial<CustomProviderSettings> & { id?: string }>;
};

type LegacyAiSettings = AiSettingsDraft & {
  custom?: Partial<CustomProviderSettings>;
  endpoint?: string;
  apiKey?: string;
  deployment?: string;
  model?: string;
};

function loadSettingsFile(): LegacyAiSettings {
  const configPath = process.env.CARD_VAULT_AI_CONFIG_PATH;
  if (!configPath) return {};
  try {
    return JSON.parse(fs.readFileSync(configPath, "utf8")) as LegacyAiSettings;
  } catch {
    return {};
  }
}

function parseRuntimeCustomProviders(): CustomProviderSettings[] | undefined {
  const raw = process.env.CARD_VAULT_CUSTOM_AI_PROFILES_JSON;
  if (raw === undefined) return undefined;
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? normalizeCustomProviders(parsed as Array<Partial<CustomProviderSettings>>) : [];
  } catch {
    return [];
  }
}

export function getAiSettingsFile(): AiSettingsFile {
  const fileSettings = normalizeSettings(loadSettingsFile());
  const provider = normalizeProvider(process.env.CARD_VAULT_AI_PROVIDER || fileSettings.provider);
  const runtimeCustomProviders = parseRuntimeCustomProviders();
  const legacyRuntimeCustom = runtimeCustomProviders === undefined && (process.env.CARD_VAULT_CUSTOM_AI_ENDPOINT || process.env.CARD_VAULT_CUSTOM_AI_MODEL)
    ? [{
        id: process.env.CARD_VAULT_CUSTOM_AI_ACTIVE_ID || "custom-env",
        name: process.env.CARD_VAULT_CUSTOM_AI_NAME,
        endpoint: process.env.CARD_VAULT_CUSTOM_AI_ENDPOINT,
        modelsEndpoint: process.env.CARD_VAULT_CUSTOM_AI_MODELS_ENDPOINT,
        apiKey: process.env.CARD_VAULT_CUSTOM_AI_API_KEY,
        model: process.env.CARD_VAULT_CUSTOM_AI_MODEL,
        apiKeyHeader: process.env.CARD_VAULT_CUSTOM_AI_API_KEY_HEADER,
        apiKeyPrefix: process.env.CARD_VAULT_CUSTOM_AI_API_KEY_PREFIX
      }]
    : undefined;

  return normalizeSettings({
    provider,
    activeCustomId: process.env.CARD_VAULT_CUSTOM_AI_ACTIVE_ID || fileSettings.activeCustomId,
    azure: {
      endpoint: process.env.AZURE_OPENAI_ENDPOINT || fileSettings.azure.endpoint,
      apiKey: process.env.AZURE_OPENAI_API_KEY || fileSettings.azure.apiKey,
      deployment: process.env.AZURE_OPENAI_DEPLOYMENT || fileSettings.azure.deployment
    },
    minimax: {
      endpoint: process.env.MINIMAX_API_ENDPOINT || fileSettings.minimax.endpoint,
      apiKey: process.env.MINIMAX_API_KEY || fileSettings.minimax.apiKey,
      model: process.env.MINIMAX_MODEL || fileSettings.minimax.model
    },
    customProviders: runtimeCustomProviders ?? legacyRuntimeCustom ?? fileSettings.customProviders
  });
}

export function getAiSettings(): ActiveAiSettings {
  const settings = getAiSettingsFile();
  if (settings.provider === "custom") {
    const active = settings.customProviders.find((item) => item.id === settings.activeCustomId) ?? settings.customProviders[0];
    return { provider: "custom", ...normalizeCustom(active, settings.activeCustomId || "custom-1") };
  }
  if (settings.provider === "minimax") return { provider: "minimax", ...settings.minimax };
  return { provider: "azure", ...settings.azure };
}

export function getActiveAiSettingsFromDraft(payload: AiSettingsDraft): ActiveAiSettings {
  const saved = getAiSettingsFile();
  const provider = normalizeProvider(payload.provider ?? saved.provider);
  if (provider === "custom") {
    const activeCustomId = (payload.activeCustomId ?? saved.activeCustomId).trim();
    const draft = payload.customProviders?.find((item) => item.id === activeCustomId);
    const fallback = saved.customProviders.find((item) => item.id === activeCustomId);
    const merged = normalizeCustom({
      ...(fallback || {}),
      ...(draft || {}),
      id: activeCustomId || draft?.id || fallback?.id,
      apiKey: draft?.apiKey === undefined ? fallback?.apiKey : draft.apiKey
    }, activeCustomId || "custom-1");
    return { provider: "custom", ...merged };
  }
  if (provider === "minimax") {
    return {
      provider: "minimax",
      endpoint: (payload.minimax?.endpoint ?? saved.minimax.endpoint).trim(),
      apiKey: (payload.minimax?.apiKey === undefined ? saved.minimax.apiKey : payload.minimax.apiKey).trim(),
      model: (payload.minimax?.model ?? saved.minimax.model).trim()
    };
  }
  return {
    provider: "azure",
    endpoint: (payload.azure?.endpoint ?? saved.azure.endpoint).trim(),
    apiKey: (payload.azure?.apiKey === undefined ? saved.azure.apiKey : payload.azure.apiKey).trim(),
    deployment: (payload.azure?.deployment ?? saved.azure.deployment).trim()
  };
}

export function getPublicAiSettings(): PublicAiSettings {
  const settings = getAiSettingsFile();
  return {
    provider: settings.provider,
    activeCustomId: settings.activeCustomId,
    azure: { endpoint: settings.azure.endpoint, deployment: settings.azure.deployment, hasApiKey: Boolean(settings.azure.apiKey) },
    minimax: { endpoint: settings.minimax.endpoint, model: settings.minimax.model, hasApiKey: Boolean(settings.minimax.apiKey) },
    customProviders: settings.customProviders.map(({ apiKey, ...item }) => ({ ...item, hasApiKey: Boolean(apiKey) }))
  };
}

export function ensureCompleteAiSettings(settings: ActiveAiSettings): ActiveAiSettings {
  const missing = settings.provider === "custom"
    ? [!settings.name ? "名称" : null, !settings.endpoint ? "Endpoint" : null, !settings.model ? "Model" : null, settings.apiKey && !isValidHeaderName(settings.apiKeyHeader) ? "有效的 API Key Header" : null]
    : settings.provider === "minimax"
      ? [!settings.endpoint ? "Endpoint" : null, !settings.apiKey ? "API Key" : null, !settings.model ? "Model" : null]
      : [!settings.endpoint ? "Endpoint" : null, !settings.apiKey ? "API Key" : null, !settings.deployment ? "Deployment" : null];
  const missingLabels = missing.filter(Boolean);
  if (missingLabels.length > 0) {
    const providerName = settings.provider === "custom" ? settings.name : settings.provider === "minimax" ? "MiniMax" : "Azure OpenAI";
    throw new Error(`${providerName} 设置不完整：缺少 ${missingLabels.join("、")}。`);
  }
  return settings;
}

export function ensureAiSettings(): ActiveAiSettings {
  return ensureCompleteAiSettings(getAiSettings());
}

export function getChatCompletionsUrl(settings: ActiveAiSettings): string {
  if (settings.provider === "minimax" || settings.provider === "custom") return settings.endpoint;
  return `${getAzureV1BaseUrl(settings.endpoint)}/chat/completions`;
}

export function getChatCompletionsHeaders(settings: ActiveAiSettings): Record<string, string> {
  if (settings.provider === "custom") {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (settings.apiKey) {
      if (!isValidHeaderName(settings.apiKeyHeader)) throw new Error("自定义 AI 的 API Key Header 无效。");
      headers[settings.apiKeyHeader] = [settings.apiKeyPrefix, settings.apiKey].filter(Boolean).join(" ");
    }
    return headers;
  }
  if (settings.provider === "minimax") return { "Content-Type": "application/json", Authorization: `Bearer ${settings.apiKey}` };
  return { "Content-Type": "application/json", "api-key": settings.apiKey };
}

export function getChatCompletionsModel(settings: ActiveAiSettings): string | undefined {
  return settings.provider === "azure" ? settings.deployment : settings.model;
}

export function getModelsUrl(settings: ActiveAiSettings): string {
  if (settings.provider === "custom") {
    if (settings.modelsEndpoint) return settings.modelsEndpoint;
    const inferred = settings.endpoint.replace(/\/chat\/completions\/?$/i, "/models");
    if (inferred === settings.endpoint) throw new Error("无法从 Chat Completions Endpoint 推断模型列表地址，请填写“模型列表 Endpoint”。");
    return inferred;
  }
  if (settings.provider === "minimax") return settings.endpoint.replace(/\/chat\/completions\/?$/i, "/models");
  return `${getAzureV1BaseUrl(settings.endpoint)}/models`;
}

export function isAzureReasoningDeployment(settings: ActiveAiSettings): boolean {
  return settings.provider === "azure" && /^gpt-5(?:$|[-.])/i.test(settings.deployment.trim());
}

function getAzureV1BaseUrl(endpoint: string): string {
  const normalized = normalizeEndpoint(endpoint);
  const existingV1Base = normalized.match(/^(.*\/openai\/v1)(?:\/(?:chat\/completions|responses|models))?$/i)?.[1];
  return existingV1Base || `${normalized}/openai/v1`;
}

function isValidHeaderName(value: string): boolean {
  return /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(value);
}
