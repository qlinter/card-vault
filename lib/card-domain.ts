export const cardVisibilities = ["private", "public", "linkOnly"] as const;
export const cardCollectionStatuses = ["holding", "listed", "sold", "grading", "target"] as const;

export type CardVisibility = (typeof cardVisibilities)[number];
export type CardCollectionStatus = (typeof cardCollectionStatuses)[number];

export const cardTextLimits = {
  required: 160,
  short: 240,
  link: 2048,
  tags: 1000,
  publicDescription: 5000,
  notes: 10000
} as const;

function trimmedString(value: FormDataEntryValue | string | null | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

export function requiredCardText(
  value: FormDataEntryValue | string | null | undefined,
  label: string,
  maxLength: number = cardTextLimits.required
): string {
  const normalized = trimmedString(value);
  if (!normalized) throw new Error(`${label}不能为空。`);
  if (normalized.length > maxLength) throw new Error(`${label}不能超过 ${maxLength} 个字符。`);
  return normalized;
}

export function optionalCardText(
  value: FormDataEntryValue | string | null | undefined,
  label: string,
  maxLength: number = cardTextLimits.short
): string | null {
  const normalized = trimmedString(value);
  if (!normalized) return null;
  if (normalized.length > maxLength) throw new Error(`${label}不能超过 ${maxLength} 个字符。`);
  return normalized;
}

export function optionalCardDate(
  value: FormDataEntryValue | string | null | undefined,
  label: string
): Date | null {
  const normalized = trimmedString(value);
  if (!normalized) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) throw new Error(`${label}格式无效。`);

  const parsed = new Date(`${normalized}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== normalized) {
    throw new Error(`${label}格式无效。`);
  }
  return parsed;
}

export function normalizeCardVisibility(value: string | null | undefined): CardVisibility {
  const normalized = value?.trim() || "private";
  if (!cardVisibilities.includes(normalized as CardVisibility)) throw new Error("不支持的公开状态。");
  return normalized as CardVisibility;
}

export function normalizeCardCollectionStatus(value: string | null | undefined): CardCollectionStatus {
  const normalized = value?.trim() || "holding";
  if (!cardCollectionStatuses.includes(normalized as CardCollectionStatus)) throw new Error("不支持的收藏状态。");
  return normalized as CardCollectionStatus;
}

export function hasSerialNumberingEvidence(
  serialNumber: string | null | undefined,
  serialRange: string | null | undefined
): boolean {
  return Boolean(serialNumber?.trim() || serialRange?.trim());
}

export function resolveIsSerialNumbered(input: {
  explicit: boolean;
  serialNumber: string | null | undefined;
  serialRange: string | null | undefined;
}): boolean {
  return input.explicit || hasSerialNumberingEvidence(input.serialNumber, input.serialRange);
}

export function normalizeCardTags(value: string | null | undefined): string | null {
  const normalized = value?.trim() ?? "";
  if (!normalized) return null;
  if (normalized.length > cardTextLimits.tags) throw new Error(`标签不能超过 ${cardTextLimits.tags} 个字符。`);
  const tags = normalized.split(",").map((tag) => tag.trim()).filter(Boolean);
  if (tags.length > 30) throw new Error("标签最多填写 30 个。");
  if (tags.some((tag) => tag.length > 40)) throw new Error("单个标签不能超过 40 个字符。");
  return [...new Set(tags)].join(",");
}
