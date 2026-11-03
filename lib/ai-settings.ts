import type { AiProxySettings } from "./ai-proxy-core.js";
import fs from "fs";
import { normalizeCustom, normalizeCustomProviders, normalizeSettings, publicAiSettings, mergeAiSettings, builtInAiProviders } from "./ai-settings-core.js";

import type { CoreAiProvider, CoreAiSettings, CoreAiSettingsDraft, CoreOpenAISettings, CoreMiniMaxSettings, CoreDeepSeekSettings, CoreCustomSettings, CorePublicAiSettings } from "./ai-settings-core.js";

export type AiProvider = CoreAiProvider;
export type OpenAIProviderSettings = CoreOpenAISettings;
export type MiniMaxProviderSettings = CoreMiniMaxSettings;
export type DeepSeekProviderSettings = CoreDeepSeekSettings;
export type CustomProviderSettings = CoreCustomSettings;
export type AiSettingsFile = CoreAiSettings;
export type PublicAiSettings = CorePublicAiSettings;
export type PublicCustomProviderSettings = PublicAiSettings["customProviders"][number];
export type AiSettingsDraft = CoreAiSettingsDraft;
export type ActiveAiSettings = { proxy?: AiProxySettings } & (
  | ({ provider: "openai" } & OpenAIProviderSettings)
  | ({ provider: "minimax" } & MiniMaxProviderSettings)
  | ({ provider: "deepseek" } & DeepSeekProviderSettings)
  | ({ provider: "custom" } & CustomProviderSettings));

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

function runtimeProxySettings(): Partial<AiProxySettings> | undefined {
  const raw = process.env.CARD_VAULT_AI_PROXY_JSON;
  if (!raw) return undefined;
  try { return JSON.parse(raw) as Partial<AiProxySettings>; } catch { throw new Error("AI 代理环境配置不是有效的 JSON。"); }
}

function getAiSettingsFile(): AiSettingsFile {
  const fileSettings = normalizeSettings(loadSettingsFile());
  const provider = process.env.CARD_VAULT_AI_PROVIDER || fileSettings.provider;
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
    proxy: runtimeProxySettings() ?? fileSettings.proxy,
    activeCustomId: process.env.CARD_VAULT_CUSTOM_AI_ACTIVE_ID || fileSettings.activeCustomId,
    openai: {
      endpoint: process.env.OPENAI_API_ENDPOINT || fileSettings.openai.endpoint,
      apiKey: process.env.OPENAI_API_KEY || fileSettings.openai.apiKey,
      model: process.env.OPENAI_MODEL || fileSettings.openai.model
    },
    ...(process.env.AZURE_OPENAI_ENDPOINT || process.env.AZURE_OPENAI_API_KEY || process.env.AZURE_OPENAI_DEPLOYMENT ? { azure: { endpoint: process.env.AZURE_OPENAI_ENDPOINT, apiKey: process.env.AZURE_OPENAI_API_KEY, deployment: process.env.AZURE_OPENAI_DEPLOYMENT } } : {}),
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
    return { provider: "custom", ...normalizeCustom(active, settings.activeCustomId || "custom-1"), proxy: settings.proxy };
  }
  if (settings.provider === "minimax" || settings.provider === "deepseek") return { provider: settings.provider, ...settings[settings.provider], proxy: settings.proxy };
  return { provider: "openai", ...settings.openai, proxy: settings.proxy };
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
    : [!settings.endpoint ? "Endpoint" : null, !settings.apiKey ? "API Key" : null, !settings.model ? "Model" : null];
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
  return settings.endpoint;
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
  return { "Content-Type": "application/json", Authorization: `Bearer ${settings.apiKey}` };
}

export function getChatCompletionsModel(settings: ActiveAiSettings): string | undefined {
  return settings.model;
}

export function getModelsUrl(settings: ActiveAiSettings): string {
  if (settings.provider === "custom") {
    if (settings.modelsEndpoint) return settings.modelsEndpoint;
    const inferred = settings.endpoint.replace(/\/chat\/completions\/?$/i, "/models");
    if (inferred === settings.endpoint) throw new Error("无法从 Chat Completions Endpoint 推断模型列表地址，请填写“模型列表 Endpoint”。");
    return inferred;
  }
  return settings.endpoint.replace(/\/chat\/completions\/?$/i, "/models");
}

export function isReasoningModel(settings: ActiveAiSettings): boolean {
  return (settings.provider === "openai" || settings.provider === "custom") && /^(?:gpt-[5-9](?:$|[-.])|o[1-9](?:$|-))/i.test(settings.model.trim());
}

function isValidHeaderName(value: string): boolean {
  return /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(value);
}
