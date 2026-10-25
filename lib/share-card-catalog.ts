import type { Prisma } from "@prisma/client";

/** Only fields needed for selection, public presentation and AI writing. */
export const shareCardCatalogSelect = {
  id: true, playerName: true, cardTitle: true, sport: true, team: true,
  year: true, brand: true, productLine: true, subsetName: true, parallel: true,
  cardNumber: true, serialNumber: true, serialRange: true, gradingCompany: true,
  grade: true, certNumber: true, publicDescription: true, visibility: true,
  tags: true, isRookie: true, isAutograph: true, autoType: true,
  isPatch: true, patchType: true,
  images: { take: 1, orderBy: { createdAt: "asc" }, select: { path: true, rotation: true } }
} satisfies Prisma.CardSelect;

export type ShareCatalogCard = Prisma.CardGetPayload<{ select: typeof shareCardCatalogSelect }>;
