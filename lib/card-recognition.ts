import type { ActiveAiSettings } from "./ai-settings.ts";
import { ensureAiSettings } from "./ai-settings.ts";
import { requestAiChatText } from "./ai-chat-client.ts";
import { extractJsonRecord, safeText } from "./ai-response-parsing.ts";
import {
  cardRecognitionFields,
  normalizeCardRecognitionResult,
  type CardRecognitionResult
} from "./card-recognition-domain.ts";

function buildRecognitionPrompt(): string {
  return [
    "你是球星卡收藏录入助手。识别用户提供的 1 到 2 张球星卡图片。第一张通常是正面，第二张通常是背面。",
    "只输出严格 JSON，不要 Markdown 或解释。格式必须为：{\"fields\":{...},\"confidence\":{\"字段\":\"high|medium|low\"}}。",
    `fields 和 confidence 只能使用这些字段：${cardRecognitionFields.join(", ")}。`,
    "不确定的信息不要编造，可省略字段；每个已返回字段都必须给出置信度。布尔字段只返回 true 或 false，其他字段返回字符串。",
    "不要估算购买价、评级费用、估值或购买渠道，不要填写 notes。",
    "publicDescription 必须使用中文，侧重球星背景、代表成就和卡片收藏意义，不要只是罗列字段。"
  ].join("\n");
}

async function repairRecognitionJson(
  settings: ActiveAiSettings,
  rawText: string
): Promise<CardRecognitionResult> {
  const content = await requestAiChatText(settings, {
    messages: [{
      role: "user",
      content: [
        "将以下球星卡识别结果修复为严格 JSON。只输出 {fields, confidence}，字段和置信度规则与原结果一致，不要解释。",
        safeText(rawText).slice(0, 5000)
      ].join("\n\n")
    }],
    maxTokens: 900,
    temperature: 0,
    operation: "识别结果修复"
  });
  return normalizeCardRecognitionResult(extractJsonRecord(content));
}

export async function recognizeCardImages(images: Array<{
  mimeType: string;
  buffer: Buffer;
}>): Promise<CardRecognitionResult> {
  if (images.length < 1 || images.length > 2) {
    throw new Error("请选择 1 到 2 张图片用于 AI 识别。");
  }
  const settings = ensureAiSettings();
  const content = await requestAiChatText(settings, {
    messages: [{
      role: "user",
      content: [
        { type: "text", text: buildRecognitionPrompt() },
        ...images.map((image) => ({
          type: "image_url",
          image_url: {
            url: `data:${image.mimeType};base64,${image.buffer.toString("base64")}`
          }
        }))
      ]
    }],
    maxTokens: 1100,
    temperature: 0,
    operation: "识别",
    timeoutMs: 90000
  });
  let result: CardRecognitionResult;
  try {
    result = normalizeCardRecognitionResult(extractJsonRecord(content));
  } catch {
    result = await repairRecognitionJson(settings, content);
  }
  if (Object.keys(result.suggestion).length < 1) {
    throw new Error("AI 未返回可用的识别字段，请调整图片后重试。");
  }
  return result;
}
