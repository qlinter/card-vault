import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { deriveCollectionTasks, taskIsVisible, type TaskCard } from "./collection-tasks";
import { moneyValue, normalizeCurrency } from "./financial-history";
import { optionalCardDate, optionalCardText, requiredCardText } from "./card-domain";

const managementCardSelect = Prisma.validator<Prisma.CardSelect>()({
  id: true, playerName: true, cardTitle: true, collectionStatus: true,
  createdAt: true, updatedAt: true, tracking: true,
  _count: { select: { images: true, transactions: { where: { kind: "purchase", amountKnown: true } } } },
  transactions: { where: { kind: "purchase", amountKnown: false }, take: 1, select: { id: true } },
  valuations: { select: { valuedAt: true } }
});

function taskCard(card: Prisma.CardGetPayload<{ select: typeof managementCardSelect }>): TaskCard {
  return { ...card, hasUnknownPurchase: card.transactions.length > 0 };
}

export async function loadCollectionManagement() {
  const now = new Date();
  const derived: ReturnType<typeof deriveCollectionTasks> = [];
  let cursor: string | undefined;
  for (;;) {
    const page = await prisma.card.findMany({ take: 250, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}), orderBy: { id: "asc" }, select: managementCardSelect });
    derived.push(...deriveCollectionTasks(page.map(taskCard), now));
    if (page.length < 250) break; cursor = page.at(-1)!.id;
  }
  const [states, plans, settings] = await Promise.all([prisma.collectionTaskState.findMany(), prisma.collectionPlan.findMany({ orderBy: [{ status: "desc" }, { targetDate: "asc" }, { createdAt: "desc" }] }), prisma.managementSettings.findUnique({ where: { id: "default" } })]);
  const stateMap = new Map(states.map(state => [state.id, state]));
  const tasks = derived.sort((a, b) => b.days - a.days || a.id.localeCompare(b.id)).map(task => ({ ...task, state: taskIsVisible(task, stateMap.get(task.id), now) ? "open" : stateMap.get(task.id)!.status }));
  const days = settings?.digestCadence === "monthly" ? 30 : 7;
  const since = new Date(now.getTime() - days * 86400000);
  // SQLite also contains text timestamps written by defaults and older tools.
  const counts = await prisma.$queryRaw<Array<{ kind: string; total: bigint }>>`
    SELECT kind, COUNT(*) total FROM (
      SELECT 'newCards' kind, createdAt eventDate FROM Card
      UNION ALL SELECT kind, occurredAt FROM CardTransaction
      UNION ALL SELECT 'valuations', valuedAt FROM CardValuation
    ) WHERE CASE WHEN typeof(eventDate)='integer' THEN eventDate
      ELSE CAST(strftime('%s',eventDate) AS INTEGER)*1000 + CAST(substr(strftime('%f',eventDate),4,3) AS INTEGER) END BETWEEN ${since.getTime()} AND ${now.getTime()}
    GROUP BY kind`;
  const count = (kind: string) => Number(counts.find(row => row.kind === kind)?.total ?? 0);
  const newCards = count('newCards'), purchases = count('purchase'), sales = count('sale'), valuations = count('valuations');
  const budgets: Record<string, string> = {};
  for (const plan of plans.filter(plan => plan.status === "planned")) if (plan.budgetMinor !== null) budgets[plan.currency] = (BigInt(budgets[plan.currency] ?? "0") + plan.budgetMinor).toString();
  return { tasks, plans: plans.map(plan => ({ ...plan, budgetMinor: plan.budgetMinor?.toString() ?? null, targetDate: plan.targetDate?.toISOString().slice(0, 10) ?? null })), budgets, settings: { digestCadence: settings?.digestCadence ?? "weekly" }, digest: { days, newCards, purchases, sales, valuations } };
}
export async function mutateCollectionManagement(body: Record<string, unknown>) {
  if (body.action === "task") {
    if (!["open", "done", "dismissed", "snoozed"].includes(String(body.status))) throw new Error("提醒状态无效。");
    // A task ID ends in its kind. Validate current evidence on that card only;
    // completing one reminder must not reload every card, plan and digest.
    const id = typeof body.id === "string" ? body.id : "";
    const cardId = id.slice(0, Math.max(0, id.lastIndexOf(":")));
    const now = new Date();
    const card = cardId ? await prisma.card.findUnique({ where: { id: cardId }, select: managementCardSelect }) : null;
    const task = card ? deriveCollectionTasks([taskCard(card)], now).find(task => task.id === id) : undefined;
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
