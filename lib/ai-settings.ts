import fs from "fs";
import { normalizeCustom, normalizeCustomProviders, normalizeEndpoint, normalizeProvider, normalizeSettings, publicAiSettings, mergeAiSettings, builtInAiProviders } from "./ai-settings-core.js";

import type { CoreAiProvider, CoreAiSettings, CoreAiSettingsDraft, CoreAzureSettings, CoreMiniMaxSettings, CoreDeepSeekSettings, CoreCustomSettings, CorePublicAiSettings } from "./ai-settings-core.js";

export type AiProvider = CoreAiProvider;
export type AzureProviderSettings = CoreAzureSettings;
export type MiniMaxProviderSettings = CoreMiniMaxSettings;
export type DeepSeekProviderSettings = CoreDeepSeekSettings;
export type CustomProviderSettings = CoreCustomSettings;
export type AiSettingsFile = CoreAiSettings;
export type PublicAiSettings = CorePublicAiSettings;
export type PublicCustomProviderSettings = PublicAiSettings["customProviders"][number];
export type AiSettingsDraft = CoreAiSettingsDraft;
export type ActiveAiSettings =
  | ({ provider: "azure" } & AzureProviderSettings)
  | ({ provider: "minimax" } & MiniMaxProviderSettings)
  | ({ provider: "deepseek" } & DeepSeekProviderSettings)
  | ({ provider: "custom" } & CustomProviderSettings);

function loadSettingsFile(): AiSettingsDraft {
  const configPath = process.env.CARD_VAULT_AI_CONFIG_PATH;
  if (!configPath) return {};
  try {
    return JSON.parse(fs.readFileSync(configPath, "utf8")) as AiSettingsDraft;
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

function getAiSettingsFile(): AiSettingsFile {
  const fileSettings = normalizeSettings(loadSettingsFile());
  const provider = normalizeProvider(process.env.CARD_VAULT_AI_PROVIDER || fileSettings.provider);
  const runtimeCustomProviders = parseRuntimeCustomProviders();
  const customEnvProfile = runtimeCustomProviders === undefined && (process.env.CARD_VAULT_CUSTOM_AI_ENDPOINT || process.env.CARD_VAULT_CUSTOM_AI_MODEL)
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
    deepseek: {
      endpoint: process.env.DEEPSEEK_API_ENDPOINT || fileSettings.deepseek.endpoint,
      apiKey: process.env.DEEPSEEK_API_KEY || fileSettings.deepseek.apiKey,
      model: process.env.DEEPSEEK_MODEL || fileSettings.deepseek.model
    },
    customProviders: runtimeCustomProviders ?? customEnvProfile ?? fileSettings.customProviders
  });
}

function activeAiSettings(settings: AiSettingsFile): ActiveAiSettings {
  if (settings.provider === "custom") {
    const active = settings.customProviders.find((item) => item.id === settings.activeCustomId) ?? settings.customProviders[0];
    return { provider: "custom", ...normalizeCustom(active, settings.activeCustomId || "custom-1") };
  }
  if (settings.provider === "minimax" || settings.provider === "deepseek") return { provider: settings.provider, ...settings[settings.provider] };
  return { provider: "azure", ...settings.azure };
}

export function getAiSettings(): ActiveAiSettings {
  return activeAiSettings(getAiSettingsFile());
}

export function getActiveAiSettingsFromDraft(payload: AiSettingsDraft): ActiveAiSettings {
  return activeAiSettings(mergeAiSettings(getAiSettingsFile(), payload));
}

export function getPublicAiSettings(): PublicAiSettings {
  return publicAiSettings(getAiSettingsFile());
}

export function ensureCompleteAiSettings(settings: ActiveAiSettings): ActiveAiSettings {
  const missing = settings.provider === "custom"
    ? [!settings.name ? "名称" : null, !settings.endpoint ? "Endpoint" : null, !settings.model ? "Model" : null, settings.apiKey && !isValidHeaderName(settings.apiKeyHeader) ? "有效的 API Key Header" : null]
    : settings.provider === "minimax" || settings.provider === "deepseek"
      ? [!settings.endpoint ? "Endpoint" : null, !settings.apiKey ? "API Key" : null, !settings.model ? "Model" : null]
      : [!settings.endpoint ? "Endpoint" : null, !settings.apiKey ? "API Key" : null, !settings.deployment ? "Deployment" : null];
  const missingLabels = missing.filter(Boolean);
  if (missingLabels.length > 0) {
    const providerName = settings.provider === "custom" ? settings.name : builtInAiProviders[settings.provider].name;
    throw new Error(`${providerName} 设置不完整：缺少 ${missingLabels.join("、")}。`);
  }
  return settings;
}

export function ensureAiSettings(): ActiveAiSettings {
  return ensureCompleteAiSettings(getAiSettings());
}

export function getChatCompletionsUrl(settings: ActiveAiSettings): string {
  if (settings.provider !== "azure") return settings.endpoint;
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
  if (settings.provider === "minimax" || settings.provider === "deepseek") return { "Content-Type": "application/json", Authorization: `Bearer ${settings.apiKey}` };
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
  if (settings.provider === "minimax" || settings.provider === "deepseek") return settings.endpoint.replace(/\/chat\/completions\/?$/i, "/models");
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
