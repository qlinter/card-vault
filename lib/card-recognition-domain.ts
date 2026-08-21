export const cardRecognitionFields = [
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

export type CardRecognitionField = (typeof cardRecognitionFields)[number];
export type CardRecognitionSuggestion = Partial<
  Record<CardRecognitionField, string | boolean>
>;
export type CardRecognitionConfidenceLevel = "high" | "medium" | "low";
export type CardRecognitionConfidence = Partial<
  Record<CardRecognitionField, CardRecognitionConfidenceLevel>
>;
export type CardRecognitionResult = {
  suggestion: CardRecognitionSuggestion;
  confidence: CardRecognitionConfidence;
};

const fieldLabels: Record<CardRecognitionField, string> = {
  playerName: "球员姓名",
  cardTitle: "卡片名称",
  sport: "运动类型",
  team: "Team",
  year: "年份",
  brand: "品牌",
  productLine: "产品线",
  subsetName: "子系列",
  parallel: "平行版本",
  cardNumber: "卡号",
  serialNumber: "编号",
  serialRange: "编号范围",
  isRookie: "Rookie",
  isAutograph: "签名卡",
  autoType: "签字类型",
  isPatch: "Patch/Jersey",
  patchType: "Patch 类型",
  gradingCompany: "评级机构",
  grade: "评级",
  certNumber: "证书号",
  publicDescription: "展示描述"
};

const booleanRecognitionFields = new Set<CardRecognitionField>([
  "isRookie",
  "isAutograph",
  "isPatch"
]);

export function cardRecognitionFieldLabel(field: CardRecognitionField): string {
  return fieldLabels[field];
}

function normalizeConfidence(value: unknown): CardRecognitionConfidenceLevel | undefined {
  return value === "high" || value === "medium" || value === "low"
    ? value
    : undefined;
}

export function normalizeCardRecognitionResult(value: unknown): CardRecognitionResult {
  const parsed = value && typeof value === "object"
    ? value as Record<string, unknown>
    : {};
  const fieldsSource = parsed.fields && typeof parsed.fields === "object"
    ? parsed.fields as Record<string, unknown>
    : parsed.suggestion && typeof parsed.suggestion === "object"
      ? parsed.suggestion as Record<string, unknown>
      : parsed;
  const confidenceSource = parsed.confidence && typeof parsed.confidence === "object"
    ? parsed.confidence as Record<string, unknown>
    : {};
  const suggestion: CardRecognitionSuggestion = {};
  const confidence: CardRecognitionConfidence = {};

  for (const field of cardRecognitionFields) {
    const raw = fieldsSource[field];
    if (!booleanRecognitionFields.has(field) && typeof raw === "string" && raw.trim()) {
      suggestion[field] = raw.trim().slice(0, field === "publicDescription" ? 2000 : 500);
    } else if (booleanRecognitionFields.has(field) && typeof raw === "boolean") {
      suggestion[field] = raw;
    } else {
      continue;
    }
    confidence[field] = normalizeConfidence(confidenceSource[field]) ?? "medium";
  }
  return { suggestion, confidence };
}

export function parseStoredCardRecognition(
  suggestionJson?: string | null,
  confidenceJson?: string | null
): CardRecognitionResult {
  try {
    return normalizeCardRecognitionResult({
      suggestion: JSON.parse(suggestionJson || "{}"),
      confidence: JSON.parse(confidenceJson || "{}")
    });
  } catch {
    return { suggestion: {}, confidence: {} };
  }
}

export function lowConfidenceCardRecognitionFields(
  confidence: CardRecognitionConfidence
): CardRecognitionField[] {
  return cardRecognitionFields.filter((field) => confidence[field] === "low");
}
