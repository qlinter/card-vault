export type DraftImage = { path: string; name: string; rotation: number };
export function readDraftImages(json: string): DraftImage[];
