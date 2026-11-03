import type { AiProxySettings, PublicAiProxySettings } from "./ai-proxy-core.js";
export type CoreAiProvider = "openai" | "minimax" | "deepseek" | "custom";
export type CoreOpenAISettings = { endpoint: string; apiKey: string; model: string };
export type CoreMiniMaxSettings = { endpoint: string; apiKey: string; model: string };
export type CoreDeepSeekSettings = CoreMiniMaxSettings;
export type CoreCustomSettings = { id: string; name: string; endpoint: string; modelsEndpoint: string; apiKey: string; model: string; apiKeyHeader: string; apiKeyPrefix: string };
export type CoreAiSettings = { provider: CoreAiProvider; activeCustomId: string; proxy: AiProxySettings; openai: CoreOpenAISettings; minimax: CoreMiniMaxSettings; deepseek: CoreDeepSeekSettings; customProviders: CoreCustomSettings[] };

export function normalizeEndpoint(value: unknown): string;
export function normalizeProvider(value: unknown): CoreAiProvider;
export function normalizeCustom(value?: unknown, fallbackId?: string): CoreCustomSettings;
export function normalizeCustomProviders(values?: unknown): CoreCustomSettings[];
export function normalizeSettings(value?: unknown): CoreAiSettings;

export type BuiltInAiProvider = Exclude<CoreAiProvider, "custom">;
export const builtInAiProviders: Readonly<Record<BuiltInAiProvider, Readonly<{ name: string; endpoint: string; model: string }>>>;
export type CorePublicAiSettings = {
  proxy: PublicAiProxySettings;
  provider: CoreAiProvider;
  activeCustomId: string;
  openai: Omit<CoreOpenAISettings, "apiKey"> & { hasApiKey: boolean };
  minimax: Omit<CoreMiniMaxSettings, "apiKey"> & { hasApiKey: boolean };
  deepseek: Omit<CoreDeepSeekSettings, "apiKey"> & { hasApiKey: boolean };
  customProviders: Array<Omit<CoreCustomSettings, "apiKey"> & { hasApiKey: boolean }>;
};
export type CoreAiSettingsDraft = {
  proxy?: Partial<AiProxySettings>;
  provider?: CoreAiProvider;
  activeCustomId?: string;
  openai?: Partial<CoreOpenAISettings>;
  minimax?: Partial<CoreMiniMaxSettings>;
  deepseek?: Partial<CoreDeepSeekSettings>;
  customProviders?: Array<Partial<CoreCustomSettings>>;
};
export function publicAiSettings(settings: CoreAiSettings): CorePublicAiSettings;
export function mergeAiSettings(current: CoreAiSettings, draft?: CoreAiSettingsDraft): CoreAiSettings;
