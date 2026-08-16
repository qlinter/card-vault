export type CoreAiProvider = "azure" | "minimax" | "custom";
export type CoreAzureSettings = { endpoint: string; apiKey: string; deployment: string };
export type CoreMiniMaxSettings = { endpoint: string; apiKey: string; model: string };
export type CoreCustomSettings = { id: string; name: string; endpoint: string; modelsEndpoint: string; apiKey: string; model: string; apiKeyHeader: string; apiKeyPrefix: string };
export type CoreAiSettings = { provider: CoreAiProvider; activeCustomId: string; azure: CoreAzureSettings; minimax: CoreMiniMaxSettings; customProviders: CoreCustomSettings[] };

export function normalizeEndpoint(value: unknown): string;
export function normalizeProvider(value: unknown): CoreAiProvider;
export function normalizeAzure(value?: unknown): CoreAzureSettings;
export function normalizeMiniMax(value?: unknown): CoreMiniMaxSettings;
export function normalizeCustom(value?: unknown, fallbackId?: string): CoreCustomSettings;
export function normalizeCustomProviders(values?: unknown): CoreCustomSettings[];
export function normalizeSettings(value?: unknown): CoreAiSettings;
