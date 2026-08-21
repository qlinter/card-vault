import type { CardFormValues } from "./card-form-values.ts";
import { normalizeCardFormValues } from "./card-entry-domain.ts";
import {
  normalizeCardCollectionStatus,
  normalizeCardTags,
  normalizeCardVisibility,
  optionalCardText
} from "./card-domain.ts";

export const cardEntryTemplateFields = [
  "sport",
  "team",
  "year",
  "brand",
  "productLine",
  "subsetName",
  "visibility",
  "collectionStatus",
  "tags"
] as const satisfies readonly (keyof CardFormValues)[];

export type CardEntryTemplateValues = Pick<
  CardFormValues,
  (typeof cardEntryTemplateFields)[number]
>;

export type CardEntryTemplateSummary = {
  id: string;
  name: string;
  values: CardEntryTemplateValues;
  useCount: number;
  lastUsedAt?: string;
  updatedAt: string;
};

export function normalizeCardEntryTemplateName(value: unknown): string {
  if (typeof value !== "string") throw new Error("请输入模板名称。");
  const normalized = value.trim().replace(/\s+/g, " ").slice(0, 80);
  if (!normalized) throw new Error("请输入模板名称。");
  return normalized;
}

export function normalizeCardEntryTemplateValues(
  input: unknown
): CardEntryTemplateValues {
  const values = normalizeCardFormValues(input);
  return {
    sport: optionalCardText(values.sport, "运动类型") ?? "",
    team: optionalCardText(values.team, "Team") ?? "",
    year: optionalCardText(values.year, "年份") ?? "",
    brand: optionalCardText(values.brand, "品牌") ?? "",
    productLine: optionalCardText(values.productLine, "产品线") ?? "",
    subsetName: optionalCardText(values.subsetName, "子系列") ?? "",
    visibility: normalizeCardVisibility(values.visibility),
    collectionStatus: normalizeCardCollectionStatus(values.collectionStatus),
    tags: normalizeCardTags(values.tags) ?? ""
  };
}

export function parseCardEntryTemplateValues(value: string): CardEntryTemplateValues {
  try {
    return normalizeCardEntryTemplateValues(JSON.parse(value));
  } catch {
    return normalizeCardEntryTemplateValues({});
  }
}

export function applyCardEntryTemplateValues(
  current: CardFormValues,
  template: CardEntryTemplateValues
): CardFormValues {
  return normalizeCardFormValues({ ...current, ...template });
}
