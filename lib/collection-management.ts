import "server-only";
import { prisma } from "./prisma";
import { deriveCollectionTasks, taskIsVisible, type TaskCard } from "./collection-tasks";
import { moneyValue, normalizeCurrency } from "./financial-history";
import { optionalCardDate, optionalCardText, requiredCardText } from "./card-domain";

export async function loadCollectionManagement() {
  const cards: Array<TaskCard & { transactions: Array<{ kind: string; occurredAt: Date }> }> = [];
  let cursor: string | undefined;
  for (;;) {
    const page = await prisma.card.findMany({ take: 250, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}), orderBy: { id: "asc" }, select: { id: true, playerName: true, cardTitle: true, collectionStatus: true, createdAt: true, updatedAt: true, _count: { select: { images: true, transactions: { where: { kind: "purchase", amountKnown: true } } } }, transactions: { select: { kind: true, occurredAt: true } }, valuations: { select: { valuedAt: true } } } });
    cards.push(...page); if (page.length < 250) break; cursor = page.at(-1)!.id;
  }
  const now = new Date();
  const [states, plans, settings] = await Promise.all([prisma.collectionTaskState.findMany(), prisma.collectionPlan.findMany({ orderBy: [{ status: "desc" }, { targetDate: "asc" }, { createdAt: "desc" }] }), prisma.managementSettings.findUnique({ where: { id: "default" } })]);
  const stateMap = new Map(states.map(state => [state.id, state]));
  const tasks = deriveCollectionTasks(cards, now).map(task => ({ ...task, state: taskIsVisible(task, stateMap.get(task.id), now) ? "open" : stateMap.get(task.id)!.status }));
  const days = settings?.digestCadence === "monthly" ? 30 : 7;
  const since = new Date(now.getTime() - days * 86400000);
  const transactions = cards.flatMap(card => card.transactions).filter(row => row.occurredAt >= since && row.occurredAt <= now);
  const purchases = transactions.filter(row => row.kind === "purchase").length;
  const sales = transactions.filter(row => row.kind === "sale").length;
  const valuations = cards.flatMap(card => card.valuations).filter(row => row.valuedAt >= since && row.valuedAt <= now).length;
  const budgets: Record<string, string> = {};
  for (const plan of plans.filter(plan => plan.status === "planned")) if (plan.budgetMinor !== null) budgets[plan.currency] = (BigInt(budgets[plan.currency] ?? "0") + plan.budgetMinor).toString();
  return { tasks, plans: plans.map(plan => ({ ...plan, budgetMinor: plan.budgetMinor?.toString() ?? null, targetDate: plan.targetDate?.toISOString().slice(0, 10) ?? null })), budgets, settings: { digestCadence: settings?.digestCadence ?? "weekly" }, digest: { days, newCards: cards.filter(card => card.createdAt >= since).length, purchases, sales, valuations } };
}
export async function mutateCollectionManagement(body: Record<string, unknown>) {
  if (body.action === "task") {
    if (!["open", "done", "dismissed", "snoozed"].includes(String(body.status))) throw new Error("提醒状态无效。");
    const task = (await loadCollectionManagement()).tasks.find(task => task.id === body.id);
    if (!task || task.fingerprint !== body.fingerprint) throw new Error("提醒已变化，请刷新后重试。");
    const data = { status: String(body.status), fingerprint: task.fingerprint, snoozedUntil: body.status === "snoozed" ? new Date(Date.now() + 7 * 86400000) : null };
    await prisma.collectionTaskState.upsert({ where: { id: task.id }, create: { id: task.id, ...data }, update: data });
  } else if (body.action === "plan") {
    const title = requiredCardText(String(body.title ?? ""), "愿望名称");
    const currency = normalizeCurrency(String(body.currency ?? "CNY"));
    const budgetMinor = body.budget === "" || body.budget === null || body.budget === undefined ? null : moneyValue({ amount: String(body.budget), currency }).amountMinor;
    const data = { title, currency, budgetMinor, playerName: optionalCardText(String(body.playerName ?? ""), "卡片主体"), notes: optionalCardText(String(body.notes ?? ""), "备注", 10000), targetDate: optionalCardDate(String(body.targetDate ?? ""), "目标日期") };
    if (body.id) await prisma.collectionPlan.update({ where: { id: String(body.id) }, data });
    else await prisma.collectionPlan.create({ data });
  } else if (body.action === "plan-status") {
    if (!["planned", "acquired", "cancelled"].includes(String(body.status))) throw new Error("计划状态无效。");
    if (body.cardId) await prisma.card.findUniqueOrThrow({ where: { id: String(body.cardId) } });
    await prisma.collectionPlan.update({ where: { id: String(body.id) }, data: { status: String(body.status), cardId: body.cardId ? String(body.cardId) : null } });
  } else if (body.action === "settings") {
    if (!["weekly", "monthly"].includes(String(body.digestCadence))) throw new Error("摘要周期无效。");
    const data = { notifications: false, digestCadence: String(body.digestCadence) };
    await prisma.managementSettings.upsert({ where: { id: "default" }, create: data, update: data });
  } else throw new Error("操作无效。");
}
