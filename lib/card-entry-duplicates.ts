import { normalizeCardFormValues } from "@/lib/card-entry-domain";
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

  // Exact certificates must not compete with the recent similar-card window.
  const [certificates, recent] = await Promise.all([
    certNumber ? prisma.card.findMany({
      where: { certNumber, id: excludeId ? { not: excludeId } : undefined },
      orderBy: [{ createdAt: "desc" }, { id: "asc" }], take: 5,
      include: { images: { take: 1, orderBy: { createdAt: "asc" } } }
    }) : Promise.resolve([]),
    playerName ? prisma.card.findMany({
      where: { playerName: { contains: playerName }, id: excludeId ? { not: excludeId } : undefined },
      orderBy: [{ createdAt: "desc" }, { id: "asc" }], take: 40,
      include: { images: { take: 1, orderBy: { createdAt: "asc" } } }
    }) : Promise.resolve([])
  ]);
  const certificateIds = new Set(certificates.map(card => card.id));
  const cards = [...new Map([...certificates, ...recent].map(card => [card.id, card])).values()];

  return cards.flatMap((card) => {
    const result = scoreCardEntryDuplicate(values, card);
    if (!result) return [];
    return [{
      id: card.id,
      playerName: card.playerName,
      cardTitle: card.cardTitle,
      ...result,
      imageUrl: card.images[0]?.path
        ? card.images[0].path
        : undefined
    }];
  }).sort((left, right) => Number(certificateIds.has(right.id)) - Number(certificateIds.has(left.id)) || right.score - left.score).slice(0, 5);
}
