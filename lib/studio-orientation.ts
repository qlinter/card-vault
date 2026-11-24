import sharp from "sharp";
import { requestAiChatText } from "./ai-chat-client";
import { extractJsonRecord } from "./ai-response-parsing";
import type { getStudioAiSettings } from "./ai-settings";

type Orientation = { rotation: number; layout: "portrait" | "landscape" };
const rotations = [0, 90, 180, 270] as const;

// Show actual candidate orientations so the model need not infer the sign of a rotation.
export async function inspectStudioOrientation(source: Buffer, settings: ReturnType<typeof getStudioAiSettings>): Promise<Orientation | null> {
  const tiles = await Promise.all(rotations.map(async (angle, index) => ({
    input: await sharp(source).rotate(angle).resize(420, 420, { fit: "contain", background: "#ddd" }).jpeg().toBuffer(),
    left: (index % 2) * 420, top: Math.floor(index / 2) * 420
  })));
  const sheet = await sharp({ create: { width: 840, height: 840, channels: 3, background: "#ddd" } }).composite(tiles).jpeg().toBuffer();
  try {
    const result = await requestAiChatText({
      provider: "openai", endpoint: "https://api.openai.com/v1/chat/completions", ...settings
    }, {
      operation: "卡面方向识别", timeoutMs: 25000, maxTokens: 500, responseFormat: "json_object",
      messages: [{ role: "user", content: [
        { type: "text", text: "Four orientations of the same collectible. Pick the view where the INNER PRINTED CARD (player, printed name, artwork) reads upright. Ignore the scan shape, mount and PSA/BGS label; the grading label can correctly read sideways. Positions: 0 upper left, 1 upper right, 2 lower left, 3 lower right. Return JSON only: {view: 0|1|2|3, layout: 'landscape'|'portrait'}. Layout describes the printed card in the chosen orientation, never the square tile or outer canvas." },
        { type: "image_url", image_url: { url: "data:image/jpeg;base64," + sheet.toString("base64") } }
      ] }]
    });
    const value = extractJsonRecord(result);
    if (typeof value.view === "number" && Number.isInteger(value.view) && value.view >= 0 && value.view < rotations.length
      && (value.layout === "landscape" || value.layout === "portrait")) {
      return { rotation: rotations[value.view], layout: value.layout };
    }
  } catch {
    // Some image-capable accounts restrict the configured chat model. The edit
    // then receives both references and resolves the card's orientation itself.
  }
  return null;
}
