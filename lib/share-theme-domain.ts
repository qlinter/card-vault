export type ShareThemeCard = {
  id: string;
  playerName: string;
  cardTitle: string;
  sport: string;
  team: string | null;
  year: string | null;
  brand: string | null;
  productLine: string | null;
  subsetName: string | null;
  parallel: string | null;
  cardNumber: string | null;
  serialNumber: string | null;
  serialRange: string | null;
  isRookie: boolean;
  isAutograph: boolean;
  autoType: string | null;
  isPatch: boolean;
  patchType: string | null;
  gradingCompany: string | null;
  grade: string | null;
  certNumber: string | null;
  publicDescription: string | null;
};

/** Pick public catalog fields explicitly before rendering or sending a card to the writing service. */
export function toShareThemeCard(card: ShareThemeCard): ShareThemeCard {
  return {
    id: card.id,
    playerName: card.playerName,
    cardTitle: card.cardTitle,
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
    gradingCompany: card.gradingCompany,
    grade: card.grade,
    certNumber: card.certNumber,
    isRookie: card.isRookie,
    isAutograph: card.isAutograph,
    autoType: card.autoType,
    isPatch: card.isPatch,
    patchType: card.patchType,
    publicDescription: card.publicDescription
  };
}

export const shareThemeFields = ["title", "subtitle", "description", "themeNarrative", "themeHighlights", "groupNotes"] as const;

export type ShareThemeField = (typeof shareThemeFields)[number];
export type ShareThemeValues = Record<ShareThemeField, string>;
