import type { Card, CardImage, ShareCollection, ShareCollectionItem } from "@prisma/client";
import type { ShareThemeId } from "@/lib/share-themes";

export type ShareExportMode = "static" | "cloud";

export type ShareCollectionWithItems = ShareCollection & {
  items: Array<
    ShareCollectionItem & {
      card: Card & { images: CardImage[] };
    }
  >;
};

export type ExportCard = {
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

export type ExportCardInput = {
  item: ShareCollectionWithItems["items"][number];
  href: string;
  images: string[];
};

export type ExportData = {
  title: string;
  theme: ShareThemeId;
  subtitle: string | null;
  description: string | null;
  themeNarrative: string | null;
  themeHighlights: string | null;
  groupNotes: string | null;
  coverImage: string | null;
  backgroundImage: string | null;
  generatedAt: string;
  mode: ShareExportMode;
  cards: ExportCard[];
};

export type ShareExportResult = {
  folderPath: string;
  zipPath: string;
  cardCount: number;
  imageCount: number;
};
