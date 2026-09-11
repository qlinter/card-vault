export type CoreAiProvider = "azure" | "minimax" | "deepseek" | "custom";
export type CoreAzureSettings = { endpoint: string; apiKey: string; deployment: string };
export type CoreMiniMaxSettings = { endpoint: string; apiKey: string; model: string };
export type CoreDeepSeekSettings = CoreMiniMaxSettings;
export type CoreCustomSettings = { id: string; name: string; endpoint: string; modelsEndpoint: string; apiKey: string; model: string; apiKeyHeader: string; apiKeyPrefix: string };
export type CoreAiSettings = { provider: CoreAiProvider; activeCustomId: string; azure: CoreAzureSettings; minimax: CoreMiniMaxSettings; deepseek: CoreDeepSeekSettings; customProviders: CoreCustomSettings[] };

export function normalizeEndpoint(value: unknown): string;
export function normalizeProvider(value: unknown): CoreAiProvider;
export function normalizeCustom(value?: unknown, fallbackId?: string): CoreCustomSettings;
export function normalizeCustomProviders(values?: unknown): CoreCustomSettings[];
export function normalizeSettings(value?: unknown): CoreAiSettings;

export type BuiltInAiProvider = Exclude<CoreAiProvider, "custom">;
export const builtInAiProviders: Readonly<Record<BuiltInAiProvider, Readonly<{ name: string; endpoint: string; model: string; modelField: "model" | "deployment" }>>>;
export type CorePublicAiSettings = {
  provider: CoreAiProvider;
  activeCustomId: string;
  azure: Omit<CoreAzureSettings, "apiKey"> & { hasApiKey: boolean };
  minimax: Omit<CoreMiniMaxSettings, "apiKey"> & { hasApiKey: boolean };
  deepseek: Omit<CoreDeepSeekSettings, "apiKey"> & { hasApiKey: boolean };
  customProviders: Array<Omit<CoreCustomSettings, "apiKey"> & { hasApiKey: boolean }>;
};
export type CoreAiSettingsDraft = {
  provider?: CoreAiProvider;
  activeCustomId?: string;
  azure?: Partial<CoreAzureSettings>;
  minimax?: Partial<CoreMiniMaxSettings>;
  deepseek?: Partial<CoreDeepSeekSettings>;
  customProviders?: Array<Partial<CoreCustomSettings>>;
};
export function publicAiSettings(settings: CoreAiSettings): CorePublicAiSettings;
export function mergeAiSettings(current: CoreAiSettings, draft?: CoreAiSettingsDraft): CoreAiSettings;
