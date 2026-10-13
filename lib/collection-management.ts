import "server-only";
import { prisma } from "./prisma";
import { deriveCollectionTasks } from "./collection-tasks";
import { taskCardSelect, taskCardsWithValuations } from "./collection-task-service";

/** Home review commands only; wish commands belong to Scout. */
export async function mutateCollectionManagement(body: Record<string, unknown>) {
  if (body.action === "task") {
    if (!["open", "done", "dismissed", "snoozed"].includes(String(body.status))) throw new Error("提醒状态无效。");
    const id = typeof body.id === "string" ? body.id : "";
    const cardId = id.slice(0, Math.max(0, id.lastIndexOf(":")));
    const now = new Date();
    const card = cardId ? await prisma.card.findUnique({ where: { id: cardId }, select: taskCardSelect }) : null;
    const task = card ? deriveCollectionTasks(await taskCardsWithValuations([card], now), now).find(task => task.id === id) : undefined;
    if (!task || task.fingerprint !== body.fingerprint) throw new Error("提醒已变化，请刷新后重试。");
    const data = { status: String(body.status), fingerprint: task.fingerprint, snoozedUntil: body.status === "snoozed" ? new Date(now.getTime() + 7 * 86400000) : null };
    await prisma.collectionTaskState.upsert({ where: { id: task.id }, create: { id: task.id, ...data }, update: data });
  } else if (body.action === "settings") {
    if (!["weekly", "monthly"].includes(String(body.digestCadence))) throw new Error("摘要周期无效。");
    const data = { digestCadence: String(body.digestCadence) };
    await prisma.managementSettings.upsert({ where: { id: "default" }, create: data, update: data });
  } else throw new Error("操作无效。");
}
