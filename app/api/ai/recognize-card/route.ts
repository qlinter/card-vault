import { NextRequest, NextResponse } from "next/server";
import {
  ActiveAiSettings,
  ensureAiSettings,
  getChatCompletionsHeaders,
  getChatCompletionsModel,
  getChatCompletionsUrl
} from "@/lib/azure-openai-settings";
import { extractJsonRecord, responseToText, safeText } from "@/lib/ai-response-parsing";

export const runtime = "nodejs";

const allowedMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const maxImageBytes = 10 * 1024 * 1024;
const suggestionFields = [
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
  "isRookie",
  "isAutograph",
  "autoType",
  "isPatch",
  "patchType",
  "gradingCompany",
  "grade",
  "certNumber",
  "publicDescription"
] as const;

type AiSuggestion = Partial<Record<(typeof suggestionFields)[number], string | boolean>>;

function isUnsupportedTokenParameter(detail: string): boolean {
  return detail.includes("Unsupported parameter") && detail.includes("max_completion_tokens");
}

function providerName(provider: string): string {
  return provider === "minimax" ? "MiniMax" : "Azure OpenAI";
}

function pickSuggestionFields(parsed: Record<string, unknown>): AiSuggestion {
  const result: AiSuggestion = {};

  for (const field of suggestionFields) {
    const raw = parsed[field];
    if (typeof raw === "string") {
      const trimmed = raw.trim();
      if (trimmed) {
        result[field] = trimmed;
      }
    } else if (typeof raw === "boolean") {
      result[field] = raw;
    }
  }

  return result;
}

function extractSuggestion(value: unknown): AiSuggestion {
  return pickSuggestionFields(extractJsonRecord(value));
}

async function repairJsonFromText(settings: ActiveAiSettings, rawText: string): Promise<AiSuggestion> {
  const url = getChatCompletionsUrl(settings);
  const headers = getChatCompletionsHeaders(settings);
  const model = getChatCompletionsModel(settings);
  const prompt = [
    "请把下面这段球星卡识别结果转换为一个严格 JSON 对象。",
    "只能输出 JSON，不要 Markdown，不要解释。",
    "字段限制为：playerName, cardTitle, sport, team, year, brand, productLine, subsetName, parallel, cardNumber, serialNumber, serialRange, isRookie, isAutograph, autoType, isPatch, patchType, gradingCompany, grade, certNumber, publicDescription。",
    "不要输出 notes。publicDescription 必须是中文，并侧重球星生涯和卡片收藏意义。",
    "",
    safeText(rawText).slice(0, 4000)
  ].join("\n");

  const requestInit = (tokenField: "max_completion_tokens" | "max_tokens") => ({
    method: "POST",
    headers,
    body: JSON.stringify({
      ...(model ? { model } : {}),
      messages: [{ role: "user", content: prompt }],
      [tokenField]: 700,
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
    throw new Error(`${providerName(settings.provider)} JSON 修复失败：${response.status} ${detail.slice(0, 240)}`);
  }

  return extractSuggestion(responseToText(await response.json()));
}

function buildPrompt(): string {
  return [
    "你是一个球星卡收藏录入助手。请识别用户提供的 1 到 2 张球星卡图片，并只返回 JSON 对象。",
    "第一张通常是卡片正面，第二张通常是卡片背面。正面常包含球员、球队、品牌、系列、平行版本、签名或 Patch 信息；背面常包含卡号、年份、版权、品牌、产品线、球员描述等。",
    "如果两张图片信息冲突，以更清晰、文本更完整的一侧为准；不确定的信息不要编造，可留空。",
    "不要估算购买价、评级费用、当前估值或购买渠道。不要填写 notes 或备注内容。",
    "publicDescription 必须使用中文，重点描述球星生涯背景、代表性成就、这张卡在收藏中的意义、年份/系列/新秀/签名/限量/评级等信息为什么重要。不要写成普通字段罗列。",
    "JSON 字段必须限制在：playerName, cardTitle, sport, team, year, brand, productLine, subsetName, parallel, cardNumber, serialNumber, serialRange, isRookie, isAutograph, autoType, isPatch, patchType, gradingCompany, grade, certNumber, publicDescription。",
    "布尔字段只返回 true 或 false。其他字段返回字符串。不要返回 Markdown，不要返回解释文字。"
  ].join("\n");
}

export async function POST(request: NextRequest) {
  try {
    const settings = ensureAiSettings();
    const formData = await request.formData();
    const files = formData.getAll("images").filter((entry): entry is File => entry instanceof File && entry.size > 0);

    if (files.length < 1 || files.length > 2) {
      return NextResponse.json({ error: "请选择 1 到 2 张图片用于 AI 识别。" }, { status: 400 });
    }

    for (const file of files) {
      if (!allowedMimeTypes.has(file.type)) {
        return NextResponse.json({ error: "AI 识别仅支持 jpg、png、webp 图片。" }, { status: 400 });
      }
      if (file.size > maxImageBytes) {
        return NextResponse.json({ error: "单张 AI 识别图片不能超过 10MB。" }, { status: 400 });
      }
    }

    const imageParts = await Promise.all(
      files.map(async (file) => ({
        type: "image_url",
        image_url: {
          url: `data:${file.type};base64,${Buffer.from(await file.arrayBuffer()).toString("base64")}`
        }
      }))
    );

    const url = getChatCompletionsUrl(settings);
    const headers = getChatCompletionsHeaders(settings);
    const model = getChatCompletionsModel(settings);
    const requestInit = (tokenField: "max_completion_tokens" | "max_tokens") => ({
      method: "POST",
      headers,
      body: JSON.stringify({
        ...(model ? { model } : {}),
        messages: [
          {
            role: "user",
            content: [{ type: "text", text: buildPrompt() }, ...imageParts]
          }
        ],
        [tokenField]: 900,
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
        { error: `${providerName(settings.provider)} 识别失败：${response.status} ${detail.slice(0, 320)}` },
        { status: 502 }
      );
    }

    const content = responseToText(await response.json());
    if (!content) {
      return NextResponse.json({ error: `${providerName(settings.provider)} 没有返回可用识别结果。` }, { status: 502 });
    }

    try {
      return NextResponse.json({ suggestion: extractSuggestion(content) });
    } catch {
      return NextResponse.json({ suggestion: await repairJsonFromText(settings, content) });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI 识别失败，请稍后重试。";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
