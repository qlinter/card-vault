import type { Prisma } from "@prisma/client";
import { homeThumbnailPublicPath } from "./card-thumbnail-core.js";

export const scoutCardSelect = {
  id: true, playerName: true, cardTitle: true, year: true, brand: true, productLine: true, parallel: true,
  cardNumber: true, serialNumber: true, serialRange: true, gradingCompany: true, grade: true, certNumber: true,
  images: { orderBy: [{ createdAt: "asc" }, { id: "asc" }], take: 1, select: { path: true, rotation: true } }
} as const satisfies Prisma.CardSelect;

export function scoutCardData(card: Prisma.CardGetPayload<{ select: typeof scoutCardSelect }>) {
  return {
    id: card.id, playerName: card.playerName, cardTitle: card.cardTitle, certNumber: card.certNumber,
    details: [card.year, card.brand, card.productLine, card.parallel, card.cardNumber ? "#" + card.cardNumber : null,
      card.serialNumber || card.serialRange ? [card.serialNumber || "—", card.serialRange].filter(Boolean).join("/") : null,
      [card.gradingCompany, card.grade].filter(Boolean).join(" ")].filter(Boolean).join(" · "),
    imagePath: card.images[0] ? homeThumbnailPublicPath(card.images[0].path) : null, imageRotation: card.images[0]?.rotation ?? 0
  };
}
