import fs from "fs";

export type AiProvider = "azure" | "minimax";

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

export type AiSettingsFile = {
  provider: AiProvider;
  azure: AzureProviderSettings;
  minimax: MiniMaxProviderSettings;
};

export type ActiveAiSettings =
  | ({ provider: "azure" } & AzureProviderSettings)
  | ({ provider: "minimax" } & MiniMaxProviderSettings);

export type PublicAiSettings = {
  provider: AiProvider;
  azure: Omit<AzureProviderSettings, "apiKey"> & { hasApiKey: boolean };
  minimax: Omit<MiniMaxProviderSettings, "apiKey"> & { hasApiKey: boolean };
};

const defaultMiniMaxEndpoint = "https://api.minimax.io/v1/chat/completions";
const defaultMiniMaxModel = "MiniMax-VL-01";

function normalizeEndpoint(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

function normalizeProvider(value: unknown): AiProvider {
  return value === "minimax" ? "minimax" : "azure";
}

function normalizeAzure(value: Partial<AzureProviderSettings> = {}): AzureProviderSettings {
  return {
    endpoint: normalizeEndpoint(value.endpoint ?? ""),
    apiKey: (value.apiKey ?? "").trim(),
    deployment: (value.deployment ?? "").trim()
  };
}

function normalizeMiniMax(value: Partial<MiniMaxProviderSettings> = {}): MiniMaxProviderSettings {
  return {
    endpoint: normalizeEndpoint(value.endpoint ?? defaultMiniMaxEndpoint),
    apiKey: (value.apiKey ?? "").trim(),
    model: (value.model ?? "").trim() || defaultMiniMaxModel
  };
}

function normalizeSettings(value: Partial<AiSettingsFile & ActiveAiSettings> = {}): AiSettingsFile {
  const provider = normalizeProvider(value.provider);

  return {
    provider,
    azure: normalizeAzure({
      ...(value.azure || {}),
      endpoint: value.azure?.endpoint ?? (provider === "azure" ? value.endpoint : undefined),
      apiKey: value.azure?.apiKey ?? (provider === "azure" ? value.apiKey : undefined),
      deployment: value.azure?.deployment ?? ("deployment" in value ? value.deployment : undefined)
    }),
    minimax: normalizeMiniMax({
      ...(value.minimax || {}),
      endpoint: value.minimax?.endpoint ?? (provider === "minimax" ? value.endpoint : undefined),
      apiKey: value.minimax?.apiKey ?? (provider === "minimax" ? value.apiKey : undefined),
      model: value.minimax?.model ?? ("model" in value ? value.model : undefined)
    })
  };
}

function loadSettingsFile(): Partial<AiSettingsFile & ActiveAiSettings> {
  const configPath = process.env.CARD_VAULT_AI_CONFIG_PATH;
  if (!configPath) {
    return {};
  }

  try {
    return JSON.parse(fs.readFileSync(configPath, "utf8")) as Partial<AiSettingsFile & ActiveAiSettings>;
  } catch {
    return {};
  }
}

export function getAiSettingsFile(): AiSettingsFile {
  const fileSettings = normalizeSettings(loadSettingsFile());
  const provider = normalizeProvider(process.env.CARD_VAULT_AI_PROVIDER || fileSettings.provider);

  return normalizeSettings({
    provider,
    azure: {
      endpoint: process.env.AZURE_OPENAI_ENDPOINT || fileSettings.azure.endpoint,
      apiKey: process.env.AZURE_OPENAI_API_KEY || fileSettings.azure.apiKey,
      deployment: process.env.AZURE_OPENAI_DEPLOYMENT || fileSettings.azure.deployment
    },
    minimax: {
      endpoint: process.env.MINIMAX_API_ENDPOINT || fileSettings.minimax.endpoint,
      apiKey: process.env.MINIMAX_API_KEY || fileSettings.minimax.apiKey,
      model: process.env.MINIMAX_MODEL || fileSettings.minimax.model
    }
  });
}

export function getAiSettings(): ActiveAiSettings {
  const settings = getAiSettingsFile();

  if (settings.provider === "minimax") {
    return { provider: "minimax", ...settings.minimax };
  }

  return { provider: "azure", ...settings.azure };
}

export function getPublicAiSettings(): PublicAiSettings {
  const settings = getAiSettingsFile();

  return {
    provider: settings.provider,
    azure: {
      endpoint: settings.azure.endpoint,
      deployment: settings.azure.deployment,
      hasApiKey: Boolean(settings.azure.apiKey)
    },
    minimax: {
      endpoint: settings.minimax.endpoint,
      model: settings.minimax.model,
      hasApiKey: Boolean(settings.minimax.apiKey)
    }
  };
}

export function ensureAiSettings(): ActiveAiSettings {
  const settings = getAiSettings();
  const missing =
    settings.provider === "minimax"
      ? [
          !settings.endpoint ? "Endpoint" : null,
          !settings.apiKey ? "API Key" : null,
          !settings.model ? "Model" : null
        ]
      : [
          !settings.endpoint ? "Endpoint" : null,
          !settings.apiKey ? "API Key" : null,
          !settings.deployment ? "Deployment" : null
        ];

  const missingLabels = missing.filter(Boolean);
  if (missingLabels.length > 0) {
    const providerName = settings.provider === "minimax" ? "MiniMax" : "Azure OpenAI";
    throw new Error(`${providerName} 设置不完整：缺少 ${missingLabels.join("、")}。`);
  }

  return settings;
}

export function getChatCompletionsUrl(settings: ActiveAiSettings): string {
  if (settings.provider === "minimax") {
    return settings.endpoint;
  }

  return `${getAzureV1BaseUrl(settings.endpoint)}/chat/completions`;
}

export function getChatCompletionsHeaders(settings: ActiveAiSettings): Record<string, string> {
  if (settings.provider === "minimax") {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${settings.apiKey}`
    };
  }

  return {
    "Content-Type": "application/json",
    "api-key": settings.apiKey
  };
}

export function getChatCompletionsModel(settings: ActiveAiSettings): string | undefined {
  if (settings.provider === "minimax") {
    return settings.model;
  }

  return settings.deployment;
}

export function getModelsUrl(settings: ActiveAiSettings): string {
  if (settings.provider === "minimax") {
    return settings.endpoint.replace(/\/chat\/completions\/?$/i, "/models");
  }

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
