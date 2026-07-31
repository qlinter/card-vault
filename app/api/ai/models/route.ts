import { NextRequest, NextResponse } from "next/server";
import {
  ActiveAiSettings,
  AiProvider,
  getAiSettingsFile,
  getChatCompletionsHeaders,
  getModelsUrl
} from "@/lib/ai-settings";

export const runtime = "nodejs";

type ModelsPayload = {
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

function trimOrFallback(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim();
  return trimmed || fallback;
}

function activeSettingsFromPayload(payload: ModelsPayload): ActiveAiSettings {
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

function extractModelIds(value: unknown): string[] {
  if (!value || typeof value !== "object") {
    return [];
  }

  const data = Array.isArray((value as { data?: unknown }).data)
    ? ((value as { data: unknown[] }).data)
    : Array.isArray((value as { value?: unknown }).value)
      ? ((value as { value: unknown[] }).value)
      : [];

  return [
    ...new Set(
      data
        .map((item) => {
          if (!item || typeof item !== "object") {
            return null;
          }
          const record = item as Record<string, unknown>;
          return record.id || record.model || record.name;
        })
        .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
        .map((item) => item.trim())
    )
  ].sort((a, b) => a.localeCompare(b));
}

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json().catch(() => ({}))) as ModelsPayload;
    const settings = activeSettingsFromPayload(payload);

    if (!settings.endpoint || !settings.apiKey) {
      throw new Error("请先填写当前服务商的 Endpoint 和 API Key。");
    }

    const response = await fetch(getModelsUrl(settings), {
      method: "GET",
      headers: getChatCompletionsHeaders(settings)
    });

    if (!response.ok) {
      const detail = await response.text();
      return NextResponse.json(
        { error: `读取模型失败：${response.status} ${detail.slice(0, 240)}` },
        { status: 502 }
      );
    }

    const data = await response.json();
    return NextResponse.json({ models: extractModelIds(data) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "读取模型失败。";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
