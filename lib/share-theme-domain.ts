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

export const shareThemeFields = ["title", "subtitle", "description", "themeNarrative", "themeHighlights", "groupNotes"] as const;

export type ShareThemeField = (typeof shareThemeFields)[number];
export type ShareThemeValues = Record<ShareThemeField, string>;
