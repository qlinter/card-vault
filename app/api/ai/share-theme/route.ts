import { NextRequest, NextResponse } from "next/server";
import {
  ActiveAiSettings,
  ensureAiSettings
} from "@/lib/ai-settings";
import { AiUpstreamError, requestAiChatText } from "@/lib/ai-chat-client";
import { cleanGeneratedText, extractJsonRecord, safeText } from "@/lib/ai-response-parsing";
import { errorMessage } from "@/lib/feedback-messages";

export const runtime = "nodejs";

type ShareThemeSuggestion = {
  title?: string;
  subtitle?: string;
  description?: string;
  themeNarrative?: string;
  themeHighlights?: string;
  groupNotes?: string;
};

type SanitizedCard = {
  playerName: string;
  cardTitle: string;
  sport: string;
  team?: string;
  year?: string;
  brand?: string;
  productLine?: string;
  subsetName?: string;
  parallel?: string;
  cardNumber?: string;
  serialNumber?: string;
  serialRange?: string;
  isRookie?: boolean;
  isAutograph?: boolean;
  autoType?: string;
  isPatch?: boolean;
  patchType?: string;
  gradingCompany?: string;
  grade?: string;
  certNumber?: string;
  publicDescription?: string;
};

const suggestionFields = ["title", "subtitle", "description", "themeNarrative", "themeHighlights", "groupNotes"] as const;
const cardTextFields = [
  "playerName",
  "cardTitle",
  "sport",
  "team",
  "year",
  "brand",
  "productLine",
  "subsetName",
  "parallel",
  "cardNumber",
  "serialNumber",
  "serialRange",
  "autoType",
  "patchType",
  "gradingCompany",
  "grade",
  "certNumber",
  "publicDescription"
] as const;

function pickThemeFields(parsed: Record<string, unknown>): ShareThemeSuggestion {
  const result: ShareThemeSuggestion = {};
  const nested = parsed.suggestion && typeof parsed.suggestion === "object" ? (parsed.suggestion as Record<string, unknown>) : parsed;

  for (const field of suggestionFields) {
    const raw = nested[field];
    if (typeof raw === "string") {
      const text = cleanGeneratedText(raw);
      if (text) {
        result[field] = text;
      }
    } else if (Array.isArray(raw)) {
      const text = raw.map((item) => cleanGeneratedText(item)).filter(Boolean).join("\n");
      if (text) {
        result[field] = text;
      }
    }
  }

  return result;
}

function extractThemeJson(value: unknown): ShareThemeSuggestion {
  return pickThemeFields(extractJsonRecord(value));
}

function coerceThemeFromText(rawText: string, cards: SanitizedCard[]): ShareThemeSuggestion {
  const text = cleanGeneratedText(rawText);
  if (!text) {
    return {};
  }

  const lines = text
    .replace(/^```(?:json|markdown|text)?/i, "")
    .replace(/```$/i, "")
    .split(/\r?\n/)
    .map((line) => cleanGeneratedText(line.replace(/^[-*#\d.\s]+/, "")))
    .filter(Boolean);
  const firstLine = lines[0] ?? "";
  const shortTitle = firstLine.length > 4 && firstLine.length <= 36 ? firstLine : "";
  const players = Array.from(new Set(cards.map((card) => card.playerName).filter(Boolean))).slice(0, 3);

  return {
    title: shortTitle || (players.length > 0 ? `${players.join(" / ")} 收藏展馆` : "球星卡收藏展馆"),
    subtitle: players.length > 0 ? `${players.join("、")} 等精选球星卡` : "精选球星卡分享集",
    description: lines.slice(0, 3).join("\n") || text.slice(0, 500),
    themeNarrative: text.slice(0, 3000)
  };
}

async function callChat(settings: ActiveAiSettings, prompt: string, maxTokens: number, temperature: number): Promise<string> {
  return requestAiChatText(settings, {
    messages: [{ role: "user", content: prompt }],
    maxTokens,
    temperature,
    operation: "主题生成"
  });
}

async function repairJsonFromText(settings: ActiveAiSettings, rawText: string, cards: SanitizedCard[]): Promise<ShareThemeSuggestion> {
  const cleanedText = cleanGeneratedText(rawText);
  const prompt = [
    "请把下面这段分享展馆文案转换成严格 JSON 对象。",
    "只能输出 JSON，不要 Markdown，不要解释，不要输出思考过程。",
    "字段限制为：title, subtitle, description, themeNarrative, themeHighlights, groupNotes。",
    "所有字段使用中文字符串；themeHighlights 和 groupNotes 可以使用换行分隔。",
    "不要把思考过程、推理过程、分析过程写入任何字段。",
    "",
    cleanedText.slice(0, 5000)
  ].join("\n");

  try {
    const responseText = await callChat(settings, prompt, 900, 0);
    return extractThemeJson(responseText);
  } catch {
    return coerceThemeFromText(cleanedText, cards);
  }
}

function sanitizeCards(value: unknown): SanitizedCard[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((raw) => {
      if (!raw || typeof raw !== "object") {
        return null;
      }

      const record = raw as Record<string, unknown>;
      const card: SanitizedCard = {
        playerName: safeText(record.playerName),
        cardTitle: safeText(record.cardTitle),
        sport: safeText(record.sport)
      };

      for (const field of cardTextFields) {
        const text = safeText(record[field]);
        if (text) {
          card[field] = text;
        }
      }

      if (typeof record.isRookie === "boolean") {
        card.isRookie = record.isRookie;
      }
      if (typeof record.isAutograph === "boolean") {
        card.isAutograph = record.isAutograph;
      }
      if (typeof record.isPatch === "boolean") {
        card.isPatch = record.isPatch;
      }

      return card.playerName || card.cardTitle ? card : null;
    })
    .filter((card): card is SanitizedCard => Boolean(card));
}

function buildPrompt(cards: SanitizedCard[], current: Record<string, unknown>): string {
  const currentDraft = Object.fromEntries(
    suggestionFields.map((field) => [field, safeText(current[field])]).filter(([, text]) => Boolean(text))
  );

  return [
    "你是一个球星卡收藏展馆策展人。请基于用户选中的球星卡，为 Card Vault 分享集生成中文精品展馆文案。",
    "目标读者是不一定熟悉这批卡的人，文字要有收藏叙事、球星生涯背景和卡片意义，不要写成字段列表。",
    "不要提及购买价格、成本、估值、购买渠道、备注或任何私人信息。",
    "只输出最终 JSON，不要 Markdown，不要解释，不要输出思考过程。",
    "不要把思考过程、推理过程、分析过程、Reasoning、Thought process 写进任何 JSON 字段。",
    "如果你是推理模型，请只返回最终可展示文案。",
    "JSON 字段必须限制为：title, subtitle, description, themeNarrative, themeHighlights, groupNotes。",
    "title：短标题，适合作为展馆名称。",
    "subtitle：一句副标题。",
    "description：封面介绍，2-4 句。",
    "themeNarrative：整体收藏叙事，2-4 段，可换行。",
    "themeHighlights：收藏亮点，每行一个亮点。",
    "groupNotes：按球员、年份、系列或主题给出分组说明，每行一个分组。",
    "",
    JSON.stringify(
      {
        currentDraft,
        cards
      },
      null,
      2
    )
  ].join("\n");
}

export async function POST(request: NextRequest) {
  try {
    const settings = ensureAiSettings();
    const payload = (await request.json()) as Record<string, unknown>;
    const cards = sanitizeCards(payload.cards);
    const current = payload.current && typeof payload.current === "object" ? (payload.current as Record<string, unknown>) : {};

    if (cards.length === 0) {
      return NextResponse.json({ error: "请先选择至少一张卡片再生成主题。" }, { status: 400 });
    }
    if (cards.length > 80) {
      return NextResponse.json({ error: "单次 AI 主题生成最多支持 80 张卡片。" }, { status: 400 });
    }

    const temperature = settings.provider === "azure" ? 0.2 : 0.5;
    const content = await callChat(settings, buildPrompt(cards, current), 1400, temperature);

    try {
      return NextResponse.json({ suggestion: extractThemeJson(content) });
    } catch {
      return NextResponse.json({ suggestion: await repairJsonFromText(settings, content, cards) });
    }
  } catch (error) {
    const message = errorMessage(error, "AI 主题生成失败，请稍后重试。");
    return NextResponse.json({ error: message }, { status: error instanceof AiUpstreamError ? 502 : 400 });
  }
}
