import { NextRequest, NextResponse } from "next/server";
import {
  ActiveAiSettings,
  AiProvider,
  getAiSettingsFile,
  getChatCompletionsHeaders,
  getChatCompletionsModel,
  getChatCompletionsUrl
} from "@/lib/azure-openai-settings";

export const runtime = "nodejs";

type TestSettingsPayload = {
  provider?: AiProvider;
  azure?: {
    endpoint?: string;
    apiKey?: string;
    deployment?: string;
    apiVersion?: string;
  };
  minimax?: {
    endpoint?: string;
    apiKey?: string;
    model?: string;
  };
};

function isUnsupportedTokenParameter(detail: string): boolean {
  return detail.includes("Unsupported parameter") && detail.includes("max_completion_tokens");
}

function providerName(provider: string): string {
  return provider === "minimax" ? "MiniMax" : "Azure OpenAI";
}

function trimOrFallback(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim();
  return trimmed || fallback;
}

function activeSettingsFromPayload(payload: TestSettingsPayload): ActiveAiSettings {
  const saved = getAiSettingsFile();
  const provider: AiProvider = payload.provider === "minimax" ? "minimax" : "azure";

  if (provider === "minimax") {
    return {
      provider,
      endpoint: trimOrFallback(payload.minimax?.endpoint, saved.minimax.endpoint),
      apiKey: trimOrFallback(payload.minimax?.apiKey, saved.minimax.apiKey),
      model: trimOrFallback(payload.minimax?.model, saved.minimax.model)
    };
  }

  return {
    provider,
    endpoint: trimOrFallback(payload.azure?.endpoint, saved.azure.endpoint),
    apiKey: trimOrFallback(payload.azure?.apiKey, saved.azure.apiKey),
    deployment: trimOrFallback(payload.azure?.deployment, saved.azure.deployment),
    apiVersion: trimOrFallback(payload.azure?.apiVersion, saved.azure.apiVersion)
  };
}

function assertComplete(settings: ActiveAiSettings): void {
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
    throw new Error(`${providerName(settings.provider)} 设置不完整：缺少 ${missingLabels.join("、")}。`);
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json().catch(() => ({}))) as TestSettingsPayload;
    const settings = activeSettingsFromPayload(payload);
    assertComplete(settings);

    const url = getChatCompletionsUrl(settings);
    const headers = getChatCompletionsHeaders(settings);
    const model = getChatCompletionsModel(settings);

    const requestInit = (tokenField: "max_completion_tokens" | "max_tokens") => ({
      method: "POST",
      headers,
      body: JSON.stringify({
        ...(model ? { model } : {}),
        messages: [{ role: "user", content: "Reply with OK." }],
        [tokenField]: 8,
        temperature: 0
      })
    });

    let response = await fetch(url, requestInit("max_completion_tokens"));
    let detail = response.ok ? "" : await response.text();

    if (!response.ok && isUnsupportedTokenParameter(detail)) {
      response = await fetch(url, requestInit("max_tokens"));
      detail = response.ok ? "" : await response.text();
    }

    if (!response.ok) {
      return NextResponse.json(
        { error: `${providerName(settings.provider)} 连接失败：${response.status} ${detail.slice(0, 240)}` },
        { status: 502 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI 设置测试失败。";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
