import { NextRequest, NextResponse } from "next/server";
import {
  AiSettingsDraft,
  getActiveAiSettingsFromDraft,
  getChatCompletionsHeaders,
  getModelsUrl
} from "@/lib/ai-settings";
import { errorMessage } from "@/lib/feedback-messages";

export const runtime = "nodejs";

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
    const payload = (await request.json().catch(() => ({}))) as AiSettingsDraft;
    const settings = getActiveAiSettingsFromDraft(payload);

    if (!settings.endpoint || (settings.provider !== "custom" && !settings.apiKey)) {
      throw new Error(settings.provider === "custom" ? "请先填写自定义 AI 的 Endpoint。" : "请先填写当前服务商的 Endpoint 和 API Key。");
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
    const message = errorMessage(error, "读取模型失败。");
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
