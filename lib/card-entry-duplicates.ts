import { normalizeCardFormValues } from "@/lib/card-entry-domain";
import { normalizeImagePath } from "@/lib/image-path";
import { prisma } from "@/lib/prisma";
import {
  scoreCardEntryDuplicate,
  type CardEntryDuplicateCandidate
} from "@/lib/card-entry-duplicate-domain";

export type { CardEntryDuplicateCandidate } from "@/lib/card-entry-duplicate-domain";

export async function findCardEntryDuplicates(
  rawValues: unknown,
  excludeId?: string
): Promise<CardEntryDuplicateCandidate[]> {
  const values = normalizeCardFormValues(rawValues);
  const playerName = values.playerName.trim();
  const certNumber = values.certNumber.trim();
  if (!playerName && !certNumber) return [];

  const cards = await prisma.card.findMany({
    where: {
      id: excludeId ? { not: excludeId } : undefined,
      OR: [
        ...(playerName ? [{ playerName: { contains: playerName } }] : []),
        ...(certNumber ? [{ certNumber }] : [])
      ]
    },
    orderBy: { createdAt: "desc" },
    take: 40,
    include: { images: { take: 1, orderBy: { createdAt: "asc" } } }
  });

  return cards.flatMap((card) => {
    const result = scoreCardEntryDuplicate(values, card);
    if (!result) return [];
    return [{
      id: card.id,
      playerName: card.playerName,
      cardTitle: card.cardTitle,
      ...result,
      imageUrl: card.images[0]?.path
        ? normalizeImagePath(card.images[0].path)
        : undefined
    }];
  }).sort((left, right) => right.score - left.score).slice(0, 5);
}
