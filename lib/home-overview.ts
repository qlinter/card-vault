import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { buildCardFilters } from "./card-helpers";
import { taskCardSelect, taskCardsWithValuations } from "./collection-task-service";
import { deriveCollectionTasks, taskIsVisible } from "./collection-tasks";

export async function loadHomeOverview(query: Parameters<typeof buildCardFilters>[0], options: { includeTasks?: boolean; handled?: boolean; page?: number } = {}) {
  const now = new Date();
  const [settings, states] = await Promise.all([prisma.managementSettings.findUnique({ where: { id: "default" } }), prisma.collectionTaskState.findMany()]);
  const cadence = settings?.digestCadence ?? "weekly";
  const days = cadence === "monthly" ? 30 : 7;
  const since = now.getTime() - days * 86400000;
  const stateMap = new Map(states.map(state => [state.id, state]));
  const tasks: Array<ReturnType<typeof deriveCollectionTasks>[number] & { state: string }> = [];
  const requestedPage = Math.max(1, Math.min(1000000, Math.floor(options.page || 1))), pageSize = 50;
  let openCount = 0, totalCount = 0, taskCount = 0;
  const compareTasks = (a: typeof tasks[number], b: typeof tasks[number]) => b.days - a.days || a.id.localeCompare(b.id);
  const digest = { days, newCards: 0, purchases: 0, sales: 0, valuations: 0 };
  let cursor: string | undefined;
  for (;;) {
    const cards = await prisma.card.findMany({ where: buildCardFilters(query), select: taskCardSelect, orderBy: { id: "asc" }, take: 250, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}) });
    if (cards.length) {
      const ids = Prisma.join(cards.map(card => card.id));
      const taskCards = await taskCardsWithValuations(cards, now);
      for (const task of deriveCollectionTasks(taskCards, now)) {
        const state = taskIsVisible(task, stateMap.get(task.id), now) ? "open" : stateMap.get(task.id)!.status;
        totalCount++;
        if (state === "open") openCount++;
        if (options.handled || state === "open") {
          taskCount++;
          if (options.includeTasks) tasks.push({ ...task, state });
        }
      }
      if (options.includeTasks) { tasks.sort(compareTasks); tasks.length = Math.min(tasks.length, requestedPage * pageSize); }
      const counts = await prisma.$queryRaw<Array<{ kind: string; total: bigint }>>(Prisma.sql`
        SELECT kind,COUNT(*) total FROM (
          SELECT 'newCards' kind,createdAt eventDate FROM Card WHERE id IN (${ids})
          UNION ALL SELECT kind,occurredAt FROM CardTransaction WHERE cardId IN (${ids})
          UNION ALL SELECT 'valuations',valuedAt FROM CardValuation WHERE cardId IN (${ids})
        ) WHERE CASE WHEN typeof(eventDate)='integer' THEN eventDate
          ELSE CAST(strftime('%s',eventDate) AS INTEGER)*1000+CAST(substr(strftime('%f',eventDate),4,3) AS INTEGER) END BETWEEN ${since} AND ${now.getTime()} GROUP BY kind`);
      for (const row of counts) {
        const key = ({ newCards: "newCards", purchase: "purchases", sale: "sales", valuations: "valuations" } as const)[row.kind as "newCards" | "purchase" | "sale" | "valuations"];
        if (key) digest[key] += Number(row.total);
      }
    }
    if (cards.length < 250) break;
    cursor = cards.at(-1)!.id;
  }
  const page = Math.min(requestedPage, Math.max(1, Math.ceil(taskCount / pageSize)));
  return { digest, tasks: options.includeTasks ? tasks.slice((page - 1) * pageSize, page * pageSize) : [], cadence, openCount, totalCount, taskCount, page, pageSize };
}
