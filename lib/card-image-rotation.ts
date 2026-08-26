import type { CSSProperties } from "react";

export type CardImageRotation = 0 | 90 | 180 | 270;

const validRotations = new Set<number>([0, 90, 180, 270]);

export function normalizeCardImageRotation(value: unknown): CardImageRotation {
  const numeric = Number(value);
  return validRotations.has(numeric) ? numeric as CardImageRotation : 0;
}

export function rotateCardImageDegrees(rotation: number, direction: -1 | 1): number {
  return (Number.isFinite(rotation) ? rotation : 0) + direction * 90;
}

export function toPersistedCardImageRotation(value: unknown): CardImageRotation {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return normalizeCardImageRotation(((numeric % 360) + 360) % 360);
}

export function cardImageRotationStyle(value: unknown, options: { continuous?: boolean } = {}): CSSProperties {
  const numeric = Number(value);
  const rotation = options.continuous && Number.isFinite(numeric)
    ? numeric
    : normalizeCardImageRotation(value);
  const orientation = toPersistedCardImageRotation(rotation);
  return {
    transform: `rotate(${rotation}deg) scale(${orientation % 180 === 0 ? 1 : 0.72})`,
    transformOrigin: "center"
  };
}

export function readCardImageRotationRecord(formData: FormData, fieldName: string): Record<string, CardImageRotation> {
  const raw = formData.get(fieldName);
  if (raw === null || raw === "") return {};
  if (typeof raw !== "string") throw new Error("图片旋转信息无效。");

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("图片旋转信息无效。");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("图片旋转信息无效。");
  }

  const result: Record<string, CardImageRotation> = {};
  for (const [id, rotation] of Object.entries(parsed)) {
    if (!id || id.length > 128 || !validRotations.has(Number(rotation))) {
      throw new Error("图片旋转信息无效。");
    }
    result[id] = Number(rotation) as CardImageRotation;
  }
  return result;
}

export function readNewCardImageRotations(formData: FormData, count: number): CardImageRotation[] {
  const raw = formData.get("newImageRotations");
  if (raw === null || raw === "") return Array.from({ length: count }, () => 0);
  if (typeof raw !== "string") throw new Error("新增图片旋转信息无效。");

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("新增图片旋转信息无效。");
  }
  if (!Array.isArray(parsed) || parsed.length !== count || parsed.some((rotation) => !validRotations.has(Number(rotation)))) {
    throw new Error("新增图片旋转信息与上传图片不匹配。");
  }
  return parsed.map((rotation) => Number(rotation) as CardImageRotation);
}
