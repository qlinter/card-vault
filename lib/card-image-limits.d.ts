export const maxImagesPerCard: number;
export const maxStoredImageBytes: number;
export const maxCardImageRequestBytes: number;
export function cardImageSelectionError(files: ReadonlyArray<{ size: number }>): string;
