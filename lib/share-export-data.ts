import { toShareThemeCard } from "./share-theme-domain.ts";
import type { ExportCard, ExportCardInput } from "./share-export-types.ts";

export function toPublicExportCard({ item, href, images }: ExportCardInput): ExportCard {
  const { publicDescription, ...card } = toShareThemeCard(item.card);
  return { ...card, displayTitle: item.displayTitle || card.cardTitle, description: item.displayDescription || publicDescription || "", href, images };
}
