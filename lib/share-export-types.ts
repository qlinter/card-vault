import type { ShareThemeCard } from "./share-theme-domain.ts";
import type { Card, CardImage, ShareCollection, ShareCollectionItem, ShareSection } from "@prisma/client";
import type { SharePresentation } from "@/lib/share-presentation";
import type { ShareSectionLayout } from "@/lib/share-sections";
import type { ShareThemeId } from "@/lib/share-themes";

export type ShareExportMode = "static" | "drop";

export type ExportImage = {
  src: string;
  thumbnailSrc: string;
  width: number;
  height: number;
  rotation?: number;
  sourceRotation?: number;
};

export type ShareCollectionWithItems = ShareCollection & {
  sections: ShareSection[];
  items: Array<
    ShareCollectionItem & {
      card: Card & { images: CardImage[] };
    }
  >;
};

export type ExportCard = Omit<ShareThemeCard, "publicDescription"> & {
  displayTitle: string;
  description: string;
  href: string;
  images: ExportImage[];
};

export type ExportSection = {
  id: string;
  title: string;
  description: string;
  layout: ShareSectionLayout;
  cardIds: string[];
  href?: string;
};

export type ExportSubject = {
  name: string;
  href: string;
  cardIds: string[];
};

export type ExportCardInput = {
  item: { card: ShareThemeCard; displayTitle?: string | null; displayDescription?: string | null };
  href: string;
  images: ExportImage[];
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
  coverRotation?: number;
  backgroundImage: string | null;
  generatedAt: string;
  mode: ShareExportMode;
  sections: ExportSection[];
  subjects?: ExportSubject[];
  cards: ExportCard[];
};

export type ShareExportResult = {
  folderPath: string;
  zipPath: string;
  reportPath: string;
  diffPath: string;
  cardCount: number;
  imageCount: number;
  fileCount: number;
  totalBytes: number;
  warningCount: number;
  diff: {
    isFirstExport: boolean;
    added: number;
    removed: number;
    changed: number;
  };
};

export type ShareExportIssue = {
  level: "error" | "warning";
  code: string;
  message: string;
  file?: string;
};
