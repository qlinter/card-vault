import { NextRequest, NextResponse } from "next/server";
import { ensureAiSettings } from "@/lib/ai-settings";
import { AiUpstreamError } from "@/lib/ai-chat-client";
import { generateShareTheme } from "@/lib/share-theme-generation";
import { errorMessage } from "@/lib/feedback-messages";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const settings = ensureAiSettings();
    const payload = await request.json() as Record<string, unknown>;
    const suggestion = await generateShareTheme(settings, payload, request.signal);
    return NextResponse.json({ suggestion });
  } catch (error) {
    const message = errorMessage(error, "AI 主题生成失败，请稍后重试。");
    return NextResponse.json({ error: message }, { status: error instanceof AiUpstreamError ? 502 : 400 });
  }
}
