import "server-only";
import { prisma } from "./prisma";
import { normalizeScoutQuery, scoutAmount, scoutCardIds, scoutTargetCount, wishProgressStatus } from "./scout-domain";
import { bindWishCards } from "./scout-binding-service";
import { optionalCardDate, optionalCardText, requiredCardText } from "./card-domain";
import { normalizeCurrency } from "./financial-history";

const text = (value: unknown, name: string, max = 500) => optionalCardText(String(value ?? ""), name, max);
const id = (value: unknown) => requiredCardText(typeof value === "string" ? value : "", "ID");
export { loadScout, type ScoutData } from "./scout-read";

export async function mutateScout(body: Record<string, unknown>) {
  if (body.action === "keyword-save") {
    const query = normalizeScoutQuery({ keyword: body.keyword });
    if (!query.keyword) throw new Error("请填写查询关键词。");
    const queryJson = JSON.stringify(query);
    return prisma.$transaction(async tx => {
      const existing = await tx.scoutWatch.findFirst({ where: { queryJson } });
      if (existing) return { id: existing.id };
      const watch = await tx.scoutWatch.create({ data: { title: query.keyword, queryJson } });
      return { id: watch.id };
    });
  }
  if (body.action === "keyword-delete") {
    await prisma.scoutWatch.delete({ where: { id: id(body.id) } });
  } else if (body.action === "keywords-delete") {
    if (!Array.isArray(body.ids) || !body.ids.length || body.ids.length > 1000) throw new Error("请选择要删除的关键词。");
    const ids = [...new Set(body.ids.map(id))];
    await prisma.$transaction(async tx => {
      const result = await tx.scoutWatch.deleteMany({ where: { id: { in: ids } } });
      if (result.count !== ids.length) throw new Error("关键词已变化，请刷新后重试。");
    });
  } else if (body.action === "wish") {
    const priority = Number(body.priority ?? 2);
    const targetCount = scoutTargetCount(body.targetCount);
    if (![1, 2, 3].includes(priority) || !Array.isArray(body.watchIds) || body.watchIds.length > 100 || body.watchIds.some(value => typeof value !== "string")) throw new Error("心愿设置无效。");
    const data = { title: requiredCardText(String(body.title ?? ""), "心愿名称"), playerName: text(body.playerName, "卡片主体"), budgetMinor: scoutAmount(body.budget), currency: normalizeCurrency(String(body.currency ?? "CNY")), targetDate: optionalCardDate(String(body.targetDate ?? ""), "目标日期"), notes: text(body.notes, "备注", 10000) };
    return prisma.$transaction(async tx => {
      const plan = body.id ? await tx.collectionPlan.update({ where: { id: id(body.id) }, data }) : await tx.collectionPlan.create({ data });
      await tx.scoutWishDetails.upsert({ where: { planId: plan.id }, create: { planId: plan.id, priority, targetCount }, update: { priority, targetCount } });
      if (plan.status !== "cancelled") {
        const count = await tx.scoutWishCard.count({ where: { planId: plan.id } });
        if (targetCount || count) await tx.collectionPlan.update({ where: { id: plan.id }, data: { status: wishProgressStatus(count, targetCount) } });
      }
      await tx.scoutWishWatch.deleteMany({ where: { planId: plan.id } });
      for (const watchId of new Set(body.watchIds as string[])) await tx.scoutWishWatch.create({ data: { planId: plan.id, watchId } });
      return { id: plan.id };
    });
  } else if (body.action === "wish-bind") {
    const wishId = id(body.id), cardIds = scoutCardIds(body.cardIds, true), previousCardIds = scoutCardIds(body.previousCardIds, true);
    const expectedStatus = body.expectedStatus ?? "acquired";
    if (expectedStatus !== "planned" && expectedStatus !== "acquired") throw new Error("心愿状态无效。");
    await prisma.$transaction(tx => bindWishCards(tx, wishId, cardIds, previousCardIds, expectedStatus));
  } else if (body.action === "wish-state") {
    if (!["planned", "acquired", "cancelled"].includes(String(body.status))) throw new Error("心愿状态无效。");
    return prisma.$transaction(async tx => {
      if (body.status === "acquired") {
        await bindWishCards(tx, id(body.id), scoutCardIds(body.cardIds));
      } else {
        const before = await tx.collectionPlan.findUniqueOrThrow({ where: { id: id(body.id) }, include: { acquiredCards: true } });
        const after = await tx.collectionPlan.update({ where: { id: before.id }, data: { status: String(body.status) } });
        await tx.scoutWishCard.deleteMany({ where: { planId: id(body.id) } });
        return { undo: { id: before.id, status: before.status, cardIds: before.acquiredCards.map(link => link.cardId), revision: after.updatedAt.toISOString() } };
      }
      return { ok: true };
    });
  } else if (body.action === "wish-undo") {
    const cardIds = scoutCardIds(body.cardIds, true), wishId = id(body.id);
    if (!["planned", "acquired", "cancelled"].includes(String(body.status)) || typeof body.revision !== "string") throw new Error("撤销数据无效。");
    await prisma.$transaction(async tx => {
      const current = await tx.collectionPlan.findUnique({ where: { id: wishId }, include: { acquiredCards: true } });
      if (!current || current.updatedAt.toISOString() !== body.revision || Date.now() - current.updatedAt.getTime() > 30000 || current.acquiredCards.length) throw new Error("心愿已变化，不能撤销此操作。");
      if (await tx.card.count({ where: { id: { in: cardIds } } }) !== cardIds.length) throw new Error("原入藏卡片已删除，不能恢复绑定。");
      await tx.collectionPlan.update({ where: { id: wishId }, data: { status: String(body.status) } });
      await tx.scoutWishCard.createMany({ data: cardIds.map(cardId => ({ planId: wishId, cardId })) });
    });
  } else if (body.action === "wish-delete") {
    await prisma.collectionPlan.delete({ where: { id: id(body.id) } });
  } else throw new Error("操作无效。");
  return { ok: true };
}
