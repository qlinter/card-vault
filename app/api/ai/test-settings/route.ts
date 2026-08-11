import { NextRequest, NextResponse } from "next/server";
import {
  ActiveAiSettings,
  AiProvider,
  getAiSettingsFile
} from "@/lib/ai-settings";
import { AiUpstreamError, aiProviderName, requestAiChat } from "@/lib/ai-chat-client";

export const runtime = "nodejs";

type TestSettingsPayload = {
  provider?: AiProvider;
  azure?: {
    endpoint?: string;
    apiKey?: string;
    deployment?: string;
  };
  minimax?: {
    endpoint?: string;
    apiKey?: string;
    model?: string;
  };
};

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
    deployment: trimOrFallback(payload.azure?.deployment, saved.azure.deployment)
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
    throw new Error(`${aiProviderName(settings.provider)} 设置不完整：缺少 ${missingLabels.join("、")}。`);
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json().catch(() => ({}))) as TestSettingsPayload;
    const settings = activeSettingsFromPayload(payload);
    assertComplete(settings);

    await requestAiChat(settings, {
      messages: [{ role: "user", content: "Reply with OK." }],
      maxTokens: 8,
      temperature: 0,
      operation: "连接测试",
      timeoutMs: 30000
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI 设置测试失败。";
    return NextResponse.json({ error: message }, { status: error instanceof AiUpstreamError ? 502 : 400 });
  }
}
