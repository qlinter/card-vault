import { NextRequest, NextResponse } from "next/server";
import {
  ActiveAiSettings,
  ensureAiSettings,
  getChatCompletionsHeaders,
  getChatCompletionsModel,
  getChatCompletionsUrl
} from "@/lib/azure-openai-settings";

export const runtime = "nodejs";

type ShareThemeSuggestion = {
  title?: string;
  subtitle?: string;
  description?: string;
  themeNarrative?: string;
  themeHighlights?: string;
  groupNotes?: string;
};

const suggestionFields = ["title", "subtitle", "description", "themeNarrative", "themeHighlights", "groupNotes"] as const;

function isUnsupportedTokenParameter(detail: string): boolean {
  return detail.includes("Unsupported parameter") && detail.includes("max_completion_tokens");
}

function providerName(provider: string): string {
  return provider === "minimax" ? "MiniMax" : "Azure OpenAI";
}

function contentToText(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") {
          return part;
        }
        if (part && typeof part === "object") {
          const record = part as Record<string, unknown>;
          if (typeof record.text === "string") {
            return record.text;
          }
          if (typeof record.content === "string") {
            return record.content;
          }
        }
        return "";
      })
      .join("\n");
  }

  return "";
}

function responseToText(data: unknown): string {
  if (!data || typeof data !== "object") {
    return "";
  }

  const record = data as Record<string, unknown>;
  for (const candidate of [record.reply, record.output_text, record.text, record.content]) {
    const text = contentToText(candidate);
    if (text.trim()) {
      return text;
    }
  }

  const choices = Array.isArray(record.choices) ? record.choices : [];
  for (const choice of choices) {
    if (!choice || typeof choice !== "object") {
      continue;
    }
    const choiceRecord = choice as Record<string, unknown>;
    const message = choiceRecord.message && typeof choiceRecord.message === "object" ? (choiceRecord.message as Record<string, unknown>) : null;
    const text =
      contentToText(message?.content) ||
      contentToText(choiceRecord.text) ||
      contentToText(choiceRecord.content) ||
      contentToText(choiceRecord.delta);
    if (text.trim()) {
      return text;
    }
  }

  return "";
}

function findJsonSlice(value: string): string | null {
  const withoutFence = value
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();

  let start = -1;
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = 0; index < withoutFence.length; index += 1) {
    const char = withoutFence[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (char === "\"") {
      inString = !inString;
      continue;
    }
    if (inString) {
      continue;
    }
    if (char === "{") {
      if (depth === 0) {
        start = index;
      }
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0 && start >= 0) {
        return withoutFence.slice(start, index + 1);
      }
    }
  }

  return null;
}

function pickThemeFields(parsed: Record<string, unknown>): ShareThemeSuggestion {
  const result: ShareThemeSuggestion = {};
  for (const field of suggestionFields) {
    const raw = parsed[field];
    if (typeof raw === "string" && raw.trim()) {
      result[field] = raw.trim();
    } else if (Array.isArray(raw)) {
      const text = raw.map((item) => String(item).trim()).filter(Boolean).join("\n");
      if (text) {
        result[field] = text;
      }
    }
  }
  return result;
}

function extractJsonObject(value: string): ShareThemeSuggestion {
  try {
    const parsed = JSON.parse(value.trim()) as unknown;
    if (typeof parsed === "string") {
      return extractJsonObject(parsed);
    }
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return pickThemeFields(parsed as Record<string, unknown>);
    }
  } catch {
    // Continue with substring extraction.
  }

  const jsonSlice = findJsonSlice(value);
  if (!jsonSlice) {
    throw new Error("AI 返回内容不是有效 JSON。");
  }

  try {
    return pickThemeFields(JSON.parse(jsonSlice) as Record<string, unknown>);
  } catch {
    throw new Error("AI 返回内容不是有效 JSON。");
  }
}

async function repairJsonFromText(settings: ActiveAiSettings, rawText: string): Promise<ShareThemeSuggestion> {
  const prompt = [
    "请把下面这段分享展馆文案转换成严格 JSON 对象。",
    "只能输出 JSON，不要 Markdown，不要解释。",
    "字段限制为：title, subtitle, description, themeNarrative, themeHighlights, groupNotes。",
    "所有字段使用中文字符串；themeHighlights 和 groupNotes 可以使用换行分隔。",
    "",
    rawText.slice(0, 5000)
  ].join("\n");

  const responseText = await callChat(settings, prompt, 900);
  return extractJsonObject(responseText);
}

async function callChat(settings: ActiveAiSettings, prompt: string, maxTokens: number): Promise<string> {
  const url = getChatCompletionsUrl(settings);
  const headers = getChatCompletionsHeaders(settings);
  const model = getChatCompletionsModel(settings);
  const requestInit = (tokenField: "max_completion_tokens" | "max_tokens") => ({
    method: "POST",
    headers,
    body: JSON.stringify({
      ...(model ? { model } : {}),
      messages: [{ role: "user", content: prompt }],
      [tokenField]: maxTokens,
      temperature: 0.7
    })
  });

  let response = await fetch(url, requestInit("max_completion_tokens"));
  let detail = response.ok ? "" : await response.text();

  if (!response.ok && isUnsupportedTokenParameter(detail)) {
    response = await fetch(url, requestInit("max_tokens"));
    detail = response.ok ? "" : await response.text();
  }

  if (!response.ok) {
    throw new Error(`${providerName(settings.provider)} 主题生成失败：${response.status} ${detail.slice(0, 320)}`);
  }

  const data = await response.json();
  const content = responseToText(data);
  if (!content) {
    throw new Error(`${providerName(settings.provider)} 没有返回可用主题内容。`);
  }

  return content;
}

function buildPrompt(payload: Record<string, unknown>): string {
  return [
    "你是一个球星卡收藏展馆策展人。请基于用户选中的球星卡，为 Card Vault 分享集生成中文精品展馆文案。",
    "目标读者是不一定熟悉这批卡的人，文字要有收藏叙事、球星生涯背景和卡片意义，不要写成字段列表。",
    "不要提及购买价格、成本、估值、购买渠道、备注或任何私人信息。",
    "只输出 JSON，不要 Markdown，不要解释。",
    "JSON 字段必须限制为：title, subtitle, description, themeNarrative, themeHighlights, groupNotes。",
    "title：短标题，适合作为展馆名称。",
    "subtitle：一句副标题。",
    "description：封面介绍，2-4 句。",
    "themeNarrative：整体收藏叙事，2-4 段，可换行。",
    "themeHighlights：收藏亮点，每行一个亮点。",
    "groupNotes：按球员、年份、系列或主题给出分组说明，每行一个分组。",
    "",
    JSON.stringify(payload, null, 2)
  ].join("\n");
}

export async function POST(request: NextRequest) {
  try {
    const settings = ensureAiSettings();
    const payload = (await request.json()) as Record<string, unknown>;
    const cards = Array.isArray(payload.cards) ? payload.cards : [];

    if (cards.length === 0) {
      return NextResponse.json({ error: "请先选择至少一张卡片再生成主题。" }, { status: 400 });
    }
    if (cards.length > 80) {
      return NextResponse.json({ error: "单次 AI 主题生成最多支持 80 张卡片。" }, { status: 400 });
    }

    const content = await callChat(settings, buildPrompt(payload), 1400);
    try {
      return NextResponse.json({ suggestion: extractJsonObject(content) });
    } catch {
      return NextResponse.json({ suggestion: await repairJsonFromText(settings, content) });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI 主题生成失败，请稍后重试。";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
