import type { Card, CardImage, ShareCollection, ShareCollectionItem, ShareSection } from "@prisma/client";
import type { SharePresentation } from "@/lib/share-presentation";
import type { ShareSectionLayout } from "@/lib/share-sections";
import type { ShareThemeId } from "@/lib/share-themes";

export type ShareExportMode = "static" | "drop";

export type ShareCollectionWithItems = ShareCollection & {
  sections: ShareSection[];
  items: Array<
    ShareCollectionItem & {
      card: Card & { images: CardImage[] };
    }
  >;
};

export type ExportCard = {
  id: string;
  playerName: string;
  cardTitle: string;
  displayTitle: string;
  description: string;
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
  href: string;
  images: string[];
};

export type ExportSection = {
  id: string;
  title: string;
  description: string;
  layout: ShareSectionLayout;
  cardIds: string[];
};

export type ExportCardInput = {
  item: ShareCollectionWithItems["items"][number];
  href: string;
  images: string[];
};

export type ExportData = {
  title: string;
  theme: ShareThemeId;
  presentation: SharePresentation;
  subtitle: string | null;
  description: string | null;
  themeNarrative: string | null;
  themeHighlights: string | null;
  groupNotes: string | null;
  coverImage: string | null;
  backgroundImage: string | null;
  generatedAt: string;
  mode: ShareExportMode;
  sections: ExportSection[];
  cards: ExportCard[];
};

export type ShareExportResult = {
  folderPath: string;
  zipPath: string;
  reportPath: string;
  cardCount: number;
  imageCount: number;
  fileCount: number;
  totalBytes: number;
  warningCount: number;
};
