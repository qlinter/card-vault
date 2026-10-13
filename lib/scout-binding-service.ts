import "server-only";
import type { Prisma } from "@prisma/client";
import { wishProgressStatus } from "./scout-domain";

export async function bindWishCards(tx: Prisma.TransactionClient, wishId: string, cardIds: string[], previousCardIds?: string[], expectedStatus = "planned") {
  const replacing = expectedStatus === "acquired";
  const plan = await tx.collectionPlan.findUnique({ where: { id: wishId }, include: { scoutDetails: true, acquiredCards: { orderBy: { cardId: "asc" } } } });
  const oldIds = plan?.acquiredCards.map(row => row.cardId) ?? [];
  if (!plan || plan.status !== expectedStatus || JSON.stringify(oldIds) !== JSON.stringify(previousCardIds ?? [])) {
    throw new Error(replacing ? "入藏绑定已变化，请刷新后重试。" : "心愿已变化，请刷新后重试。");
  }
  if (!cardIds.length && !plan.scoutDetails?.targetCount) throw new Error("请选择至少一张入藏卡片。");
  const newIds = cardIds.filter(id => !oldIds.includes(id));
  const heldCount = await tx.card.count({ where: { id: { in: newIds }, collectionStatus: { not: "sold" }, holdingQuantity: { gt: 0 } } });
  if (heldCount !== newIds.length) throw new Error("请选择实际持有的卡片。");
  await tx.scoutWishCard.deleteMany({ where: { planId: wishId } });
  await tx.scoutWishCard.createMany({ data: cardIds.map(cardId => ({ planId: wishId, cardId })) });
  await tx.collectionPlan.update({ where: { id: wishId }, data: { status: wishProgressStatus(cardIds.length, plan.scoutDetails?.targetCount ?? null) } });
}
