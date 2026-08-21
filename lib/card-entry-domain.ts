import type { Card } from "@prisma/client";
import type { CardFormValues } from "./card-form-values.ts";
import { emptyCardFormValues } from "./card-form-values.ts";
import {
  cardTextLimits,
  normalizeCardCollectionStatus,
  normalizeCardTags,
  normalizeCardVisibility,
  optionalCardText,
  requiredCardText,
  resolveIsSerialNumbered
} from "./card-domain.ts";
import { normalizeHttpUrl } from "./http-url.ts";

export const cardEntryDraftSchemaVersion = 1;

export const cardFormStringFields = [
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
  "gradingCompany",
  "grade",
  "certNumber",
  "gradingLink",
  "visibility",
  "collectionStatus",
  "purchaseDate",
  "purchasePrice",
  "gradingFee",
  "totalCost",
  "currentValue",
  "purchaseSource",
  "historyCurrency",
  "valuationDate",
  "valuationSource",
  "tags",
  "publicDescription",
  "notes",
  "autoType",
  "patchType"
] as const satisfies readonly (keyof CardFormValues)[];

export const cardFormBooleanFields = [
  "isSerialNumbered", "isRookie", "isAutograph", "isPatch"
] as const satisfies readonly (keyof CardFormValues)[];

export type CardEntrySaveIntent = "view" | "continue" | "copy";

const maxDraftFieldLength = 10_000;

export function normalizeCardEntryId(value: unknown): string | undefined {
  if (typeof value !== "string") return;
  const normalized = value.trim();
  return /^[A-Za-z0-9_-]{1,128}$/.test(normalized) ? normalized : undefined;
}

function freshEmptyValues(): CardFormValues {
  return { ...emptyCardFormValues };
}

function boundedDraftString(value: unknown): string {
  return typeof value === "string" ? value.slice(0, maxDraftFieldLength) : "";
}

export function normalizeCardFormValues(input: unknown): CardFormValues {
  const source = input && typeof input === "object"
    ? input as Record<string, unknown>
    : {};
  const values = freshEmptyValues();

  for (const field of cardFormStringFields) {
    const value = boundedDraftString(source[field]);
    values[field] = value || emptyCardFormValues[field];
  }
  for (const field of cardFormBooleanFields) {
    values[field] = source[field] === true;
  }

  return values;
}

export function readCardFormValues(formData: FormData): CardFormValues {
  const source: Record<string, unknown> = {};
  for (const field of cardFormStringFields) {
    const value = formData.get(field);
    source[field] = typeof value === "string" ? value : "";
  }
  for (const field of cardFormBooleanFields) {
    source[field] = formData.get(field) === "on" || formData.get(field) === "true";
  }
  return normalizeCardFormValues(source);
}

export function readCardEntrySaveIntent(formData: FormData): CardEntrySaveIntent {
  const value = formData.get("saveIntent");
  return value === "continue" || value === "copy" ? value : "view";
}

export function serializeCardEntryDraftValues(values: CardFormValues): string {
  return JSON.stringify(normalizeCardFormValues(values));
}

export function parseCardEntryDraftValues(value: string): CardFormValues {
  try {
    return normalizeCardFormValues(JSON.parse(value));
  } catch {
    return freshEmptyValues();
  }
}

export function hasCardEntryDraftContent(values: CardFormValues): boolean {
  return (
    cardFormStringFields.some((field) => {
      const value = values[field];
      return Boolean(value.trim() && value !== emptyCardFormValues[field]);
    }) || cardFormBooleanFields.some((field) => values[field] === true)
  );
}

export function cardEntryDraftTitle(values: CardFormValues): string {
  const parts = [values.playerName, values.cardTitle, values.year, values.productLine]
    .map((value) => value.trim())
    .filter(Boolean);
  return parts.slice(0, 3).join(" · ") || "未命名草稿";
}

type CardCopySource = Pick<
  Card,
  | "sport"
  | "team"
  | "year"
  | "brand"
  | "productLine"
  | "subsetName"
  | "visibility"
  | "collectionStatus"
>;

export function copyCommonCardValues(card: CardCopySource): CardFormValues {
  return normalizeCardFormValues({
    ...emptyCardFormValues,
    sport: card.sport,
    team: card.team ?? "",
    year: card.year ?? "",
    brand: card.brand ?? "",
    productLine: card.productLine ?? "",
    subsetName: card.subsetName ?? "",
    visibility: card.visibility,
    collectionStatus: card.collectionStatus
  });
}

export function buildCardData(values: CardFormValues) {
  const serialNumber = optionalCardText(values.serialNumber, "编号");
  const serialRange = optionalCardText(values.serialRange, "编号范围");
  const gradingLinkRaw = optionalCardText(values.gradingLink, "评级链接", cardTextLimits.link);
  const gradingLink = normalizeHttpUrl(gradingLinkRaw);
  if (gradingLinkRaw && !gradingLink) {
    throw new Error("评级链接必须是有效的 http 或 https 地址。");
  }

  return {
    playerName: requiredCardText(values.playerName, "球员姓名"),
    cardTitle: requiredCardText(values.cardTitle, "卡片名称"),
    sport: requiredCardText(values.sport, "运动类型"),
    team: optionalCardText(values.team, "Team"),
    year: optionalCardText(values.year, "年份"),
    brand: optionalCardText(values.brand, "品牌"),
    productLine: optionalCardText(values.productLine, "产品线"),
    subsetName: optionalCardText(values.subsetName, "子系列"),
    parallel: optionalCardText(values.parallel, "平行版本"),
    cardNumber: optionalCardText(values.cardNumber, "卡号"),
    isSerialNumbered: resolveIsSerialNumbered({
      explicit: values.isSerialNumbered,
      serialNumber,
      serialRange
    }),
    serialNumber,
    serialRange,
    isRookie: values.isRookie,
    isAutograph: values.isAutograph,
    autoType: optionalCardText(values.autoType, "签字类型"),
    isPatch: values.isPatch,
    patchType: optionalCardText(values.patchType, "Patch 类型"),
    gradingCompany: optionalCardText(values.gradingCompany, "评级机构"),
    grade: optionalCardText(values.grade, "评级"),
    certNumber: optionalCardText(values.certNumber, "证书号"),
    gradingLink,
    visibility: normalizeCardVisibility(values.visibility),
    collectionStatus: normalizeCardCollectionStatus(values.collectionStatus),
    tags: normalizeCardTags(values.tags),
    publicDescription: optionalCardText(
      values.publicDescription,
      "展示描述",
      cardTextLimits.publicDescription
    ),
    notes: optionalCardText(values.notes, "备注", cardTextLimits.notes)
  };
}
