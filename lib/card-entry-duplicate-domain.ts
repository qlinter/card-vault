import type { CardFormValues } from "./card-form-values.ts";

const duplicateFields = [
  ["year", "年份", 1],
  ["brand", "品牌", 1],
  ["productLine", "产品线", 2],
  ["subsetName", "子系列", 1],
  ["cardNumber", "卡号", 3],
  ["parallel", "平行版本", 2],
  ["serialNumber", "编号", 3],
  ["serialRange", "编号范围", 1],
  ["gradingCompany", "评级机构", 1],
  ["grade", "评级", 1]
] as const satisfies readonly (readonly [keyof CardFormValues, string, number])[];

export type CardEntryDuplicateCandidate = {
  id: string;
  playerName: string;
  cardTitle: string;
  level: "high" | "possible";
  score: number;
  matches: string[];
  imageUrl?: string;
};

function canonical(value: unknown): string {
  return typeof value === "string"
    ? value.normalize("NFKC").trim().toLocaleLowerCase().replace(/\s+/g, "")
    : "";
}

export function scoreCardEntryDuplicate(
  input: CardFormValues,
  card: Partial<Record<keyof CardFormValues, unknown>>
): Pick<CardEntryDuplicateCandidate, "level" | "score" | "matches"> | null {
  const inputPlayer = canonical(input.playerName);
  const cardPlayer = canonical(card.playerName);
  const certMatches = Boolean(
    canonical(input.certNumber) && canonical(input.certNumber) === canonical(card.certNumber)
  );
  if (!certMatches && (!inputPlayer || inputPlayer !== cardPlayer)) return null;

  let score = certMatches ? 6 : 3;
  const matches = certMatches ? ["证书号"] : ["球员姓名"];
  for (const [field, label, weight] of duplicateFields) {
    const inputValue = canonical(input[field]);
    if (inputValue && inputValue === canonical(card[field])) {
      score += weight;
      matches.push(label);
    }
  }
  if (!certMatches && matches.length < 2) return null;
  if (score < 5) return null;
  return {
    level: certMatches || score >= 8 ? "high" : "possible",
    score,
    matches
  };
}
