import { fetchAi } from "./ai-fetch.ts";
import { builtInAiProviders } from "./ai-settings-core.js";
import type { getStudioAiSettings } from "./ai-settings.ts";
import sharp from "sharp";

type StudioSettings = ReturnType<typeof getStudioAiSettings>;
export const studioLighting = "Diffused warm upper-left window light, a pale warm-grey studio wall, an ivory matte plinth and soft rightward cast shadows.";

export function studioVisionSettings(settings: StudioSettings) {
  return { provider: "openai" as const, endpoint: builtInAiProviders.openai.endpoint, model: builtInAiProviders.openai.model, apiKey: settings.apiKey, proxy: settings.proxy };
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
    await response.body?.cancel();
    throw new Error("OpenAI 图片生成失败（HTTP " + response.status + "）。请检查密钥、模型权限和额度。");
  }
  const encoded = (await response.json()).data?.[0]?.b64_json;
  if (typeof encoded !== "string" || !encoded) throw new Error("OpenAI 未返回图片。");
  return sharp(Buffer.from(encoded, "base64")).png().toBuffer();
}
