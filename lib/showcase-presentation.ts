export function fitShowcaseImage(width: number, height: number, frameWidth: number, frameHeight: number, rotation: number) {
  if (![width, height, frameWidth, frameHeight].every(value => Number.isFinite(value) && value > 0)) return null;
  const angle = Number.isFinite(rotation) ? rotation * Math.PI / 180 : 0;
  const cos = Math.abs(Math.cos(angle)), sin = Math.abs(Math.sin(angle));
  const scale = Math.min(frameWidth / (width * cos + height * sin), frameHeight / (width * sin + height * cos));
  return { width: width * scale, height: height * scale };
}

type ShowcaseDetails = {
  year?: string | null; brand?: string | null; productLine?: string | null;
  parallel?: string | null; cardNumber?: string | null;
  serialNumber?: string | null; serialRange?: string | null;
  gradingCompany?: string | null; grade?: string | null;
};

function joined(values: Array<string | null | undefined>, separator = " · ") {
  return [...new Set(values.map(value => value?.trim()).filter((value): value is string => Boolean(value)))].join(separator);
}

export function showcaseFacts(card: ShowcaseDetails) {
  const serial = card.serialNumber?.trim() ?? "";
  const range = card.serialRange?.trim() ?? "";
  const serialLabel = range ? `${serial}${range.startsWith("/") ? "" : "/"}${range}` : serial;
  return [
    { label: "年份", value: card.year?.trim() },
    { label: "系列", value: joined([card.brand, card.productLine]) },
    { label: "版本", value: card.parallel?.trim() },
    { label: "评级", value: joined([card.gradingCompany, card.grade], " ") },
    { label: "卡号", value: card.cardNumber?.trim() },
    { label: "限量编号", value: serialLabel }
  ].filter((fact): fact is { label: string; value: string } => Boolean(fact.value));
}
