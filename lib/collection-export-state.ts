export const maximumExportSelection = 10000;

export type CollectionExportState = { url: string; selected: string[]; publicOnly: boolean };

export function restoreCollectionExport(value: unknown, url: string): CollectionExportState {
  const empty = { url, selected: [], publicOnly: false };
  if (!value || typeof value !== "object") return empty;
  const saved = (value as { cardVaultCollectionExport?: Partial<CollectionExportState> }).cardVaultCollectionExport;
  if (saved?.url !== url || !Array.isArray(saved.selected)) return empty;
  return { url, selected: [...new Set(saved.selected.filter((id): id is string => typeof id === "string" && id.length > 0))].slice(0, maximumExportSelection), publicOnly: saved.publicOnly === true };
}

export function saveCollectionExport(value: unknown, snapshot: CollectionExportState) {
  return { ...(value && typeof value === "object" ? value : {}), cardVaultCollectionExport: snapshot };
}
