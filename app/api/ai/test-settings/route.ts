import { NextRequest, NextResponse } from "next/server";
import {
  AiSettingsDraft,
  ensureCompleteAiSettings,
  getActiveAiSettingsFromDraft
} from "@/lib/ai-settings";
import { AiUpstreamError, requestAiChat } from "@/lib/ai-chat-client";
import { errorMessage } from "@/lib/feedback-messages";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json().catch(() => ({}))) as AiSettingsDraft;
    const settings = ensureCompleteAiSettings(getActiveAiSettingsFromDraft(payload));

    await requestAiChat(settings, {
      messages: [{ role: "user", content: "Reply with OK." }],
      maxTokens: 8,
      temperature: 0,
      operation: "连接测试",
      timeoutMs: 30000
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = errorMessage(error, "AI 设置测试失败。");
    return NextResponse.json({ error: message }, { status: error instanceof AiUpstreamError ? 502 : 400 });
  }
}
