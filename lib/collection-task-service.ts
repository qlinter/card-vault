import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import type { TaskCard } from "./collection-tasks";

export const taskCardSelect = {
  id: true, playerName: true, cardTitle: true, collectionStatus: true, createdAt: true, updatedAt: true, tracking: true,
  _count: { select: { images: true, transactions: { where: { kind: "purchase", amountKnown: true } } } },
  transactions: { where: { kind: "purchase", amountKnown: false }, take: 1, select: { id: true } }
} as const satisfies Prisma.CardSelect;

export async function taskCardsWithValuations(cards: Array<Prisma.CardGetPayload<{ select: typeof taskCardSelect }>>, now: Date): Promise<TaskCard[]> {
  if (!cards.length) return [];
  const latest = await prisma.$queryRaw<Array<{ cardId: string; valuedAt: bigint }>>(Prisma.sql`
    WITH dates AS (SELECT cardId, CASE WHEN typeof(valuedAt)='integer' THEN valuedAt
      ELSE CAST(strftime('%s',valuedAt) AS INTEGER)*1000+CAST(substr(strftime('%f',valuedAt),4,3) AS INTEGER) END stamp
      FROM CardValuation WHERE cardId IN (${Prisma.join(cards.map(card => card.id))}))
    SELECT cardId,MAX(stamp) valuedAt FROM dates WHERE stamp <= ${now.getTime()} GROUP BY cardId`);
  const dates = new Map(latest.map(row => [row.cardId, new Date(Number(row.valuedAt))]));
  return cards.map(card => ({ ...card, hasUnknownPurchase: card.transactions.length > 0, valuations: dates.has(card.id) ? [{ valuedAt: dates.get(card.id)! }] : [] }));
}
