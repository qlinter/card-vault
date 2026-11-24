/** Legacy images have equal rank; retain the existing creation-date and id tie breakers. */
export const cardImageOrder = [{ sortOrder: "asc" as const }, { createdAt: "asc" as const }, { id: "asc" as const }];
