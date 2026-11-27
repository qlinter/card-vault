import { fetchAi, redactAiError } from "./ai-fetch.ts";
import { builtInAiProviders } from "./ai-settings-core.js";
import type { getStudioAiSettings } from "./ai-settings.ts";
import sharp from "sharp";

type StudioSettings = ReturnType<typeof getStudioAiSettings>;
export const studioLighting = "Diffused warm upper-left window light, a pale warm-grey studio wall, an ivory matte plinth and soft rightward cast shadows.";

export function studioVisionSettings(settings: StudioSettings) {
  return { provider: "openai" as const, endpoint: builtInAiProviders.openai.endpoint, model: builtInAiProviders.openai.model, apiKey: settings.apiKey, proxy: settings.proxy };
}

export class StudioModerationError extends Error {
  readonly requestId: string | null;
  constructor(requestId: string | null) {
    super("OpenAI 安全审核已拦截此次生图请求。如需复核，请联系 help.openai.com。" + (requestId ? " 请求 ID " + requestId : ""));
    this.requestId = requestId;
  }
}

async function studioRequestError(response: Response, apiKey: string) {
  const payload = await response.json().catch(() => null);
  const error = payload?.error;
  function safeText(value: unknown, limit: number) {
    if (typeof value !== "string") return "";
    const text = redactAiError(value, apiKey)
      .replace(/Bearer\s+[^\s,;]+/gi, "[REDACTED]")
      .replace(/[A-Za-z0-9+/=_-]{80,}/g, "[…]").replace(/\s+/g, " ").trim();
    return text.slice(0, limit);
  }
  if (error?.code === "moderation_blocked") {
    const header = response.headers.get("x-request-id") || "";
    const id = /^req_[a-zA-Z0-9_-]{1,96}$/.test(header) ? header
      : safeText(error.message, 1000).match(/\breq_[a-zA-Z0-9_-]{1,96}\b/)?.[0];
    return new StudioModerationError(id ?? null);
  }
  const details = [
    safeText(error?.message, 350),
    safeText(error?.code, 80),
    safeText(error?.param, 80),
    safeText(response.headers.get("x-request-id"), 100)
  ].filter(Boolean);
  return new Error(`OpenAI 图片生成失败（HTTP ${response.status}）。${details.join(" · ") || "接口未返回详细原因。"}`);
}

export async function editStudioImage(settings: StudioSettings, prompt: string, size: string, images: { name: string; png: Buffer }[], signal?: AbortSignal) {
  const body = new FormData();
  for (const [key, value] of Object.entries({ model: settings.imageModel, size, quality: "high", output_format: "png", n: "1", prompt })) body.set(key, value);
  for (const image of images) body.append("image[]", new Blob([new Uint8Array(image.png)], { type: "image/png" }), image.name);
  const timeout = AbortSignal.timeout(360000);
  const response = await fetchAi("https://api.openai.com/v1/images/edits", {
    method: "POST", headers: { Authorization: "Bearer " + settings.apiKey }, body, redirect: "error",
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout
  }, settings.proxy);
  if (!response.ok) {
    throw await studioRequestError(response, settings.apiKey);
  }
  const encoded = (await response.json()).data?.[0]?.b64_json;
  if (typeof encoded !== "string" || !encoded) throw new Error("OpenAI 未返回图片。");
  return sharp(Buffer.from(encoded, "base64")).png().toBuffer();
}
