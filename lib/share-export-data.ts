import type { ExportCard, ExportCardInput } from "./share-export-types.ts";

export function toPublicExportCard({ item, href, images }: ExportCardInput): ExportCard {
  const card = item.card;

  return {
    playerName: card.playerName,
    cardTitle: card.cardTitle,
    displayTitle: item.displayTitle || card.cardTitle,
    description: item.displayDescription || card.publicDescription || "",
    sport: card.sport,
    team: card.team,
    year: card.year,
    brand: card.brand,
    productLine: card.productLine,
    subsetName: card.subsetName,
    parallel: card.parallel,
    cardNumber: card.cardNumber,
    serialNumber: card.serialNumber,
    serialRange: card.serialRange,
    isRookie: card.isRookie,
    isAutograph: card.isAutograph,
    autoType: card.autoType,
    isPatch: card.isPatch,
    patchType: card.patchType,
    gradingCompany: card.gradingCompany,
    grade: card.grade,
    certNumber: card.certNumber,
    href,
    images
  };
}
