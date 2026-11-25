export type StudioCard = { id: string; cardTitle: string; images: { id: string; path: string; rotation: number }[] };
export function studioFilename(card: StudioCard): string | null;
export function oversized(card: StudioCard): boolean;
