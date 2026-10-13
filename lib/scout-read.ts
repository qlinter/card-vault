import "server-only";
import { prisma } from "./prisma";
import { matchesSearch } from "./search-terms";
import { scoutIdentity } from "./scout-identity";

const serialize = <T>(value: T) => JSON.parse(JSON.stringify(value, (_, entry) => typeof entry === "bigint" ? entry.toString() : entry)) as Serialized<T>;
type Serialized<T> = T extends bigint ? string : T extends Date ? string : T extends Array<infer U> ? Serialized<U>[] : T extends object ? { [K in keyof T]: Serialized<T[K]> } : T;
export async function loadScout(options: { window?: boolean; search?: string; wishSearch?: string; wishSort?: string; watchPage?: number; wishPage?: number; cancelledPage?: number; showAcquired?: boolean } = {}) {
  const watchPageSize = 50, wishPageSize = 20;
  const [keywords, wishes, budgetRows] = await Promise.all([
    prisma.scoutWatch.findMany({ orderBy: [{ createdAt: "desc" }, { id: "desc" }], select: { id: true, title: true } }),
    prisma.collectionPlan.findMany({ orderBy: [{ createdAt: "desc" }, { id: "desc" }], select: { id: true, title: true, playerName: true, status: true, targetDate: true, scoutDetails: { select: { priority: true } }, scoutWatches: { select: { watchId: true } } } }),
    prisma.collectionPlan.findMany({ where: { status: "planned", budgetMinor: { not: null } }, select: { currency: true, budgetMinor: true } })
  ]);
  const keywordOptions = keywords.map(row => ({ id: row.id, keyword: row.title }));
  const keywordMap = new Map(keywordOptions.map(row => [row.id, row.keyword]));
  const sorted = options.wishSort === "recent" ? wishes : wishes.sort((a, b) => options.wishSort === "target" ? (a.targetDate?.getTime() ?? Infinity) - (b.targetDate?.getTime() ?? Infinity) || 0 : (a.scoutDetails?.priority ?? 2) - (b.scoutDetails?.priority ?? 2));
  const wishOptions = sorted.map(row => ({ id: row.id, title: row.title, status: row.status, watchIds: row.scoutWatches.map(link => link.watchId) }));
  const matchingIds = new Set(sorted.filter(row => matchesSearch([row.title, row.playerName, ...row.scoutWatches.map(link => keywordMap.get(link.watchId))].filter(Boolean).join(" "), options.wishSearch ?? "")).map(row => row.id));
  const filtered = keywordOptions.filter(row => row.keyword.toLowerCase().includes((options.search ?? "").trim().toLowerCase()));
  const visible = wishOptions.filter(row => matchingIds.has(row.id) && (row.status === "planned" || (options.showAcquired && row.status === "acquired")));
  const cancelled = wishOptions.filter(row => matchingIds.has(row.id) && row.status === "cancelled");
  const page = (requested: number | undefined, total: number, size: number) => Math.min(Math.max(1, Math.floor(requested || 1)), Math.max(1, Math.ceil(total / size)));
  const watchPage = page(options.watchPage, filtered.length, watchPageSize), wishPage = page(options.wishPage, visible.length, wishPageSize), cancelledPage = page(options.cancelledPage, cancelled.length, wishPageSize);
  const windowIds = (rows: Array<{ id: string }>, page: number, size: number) => rows.slice((page - 1) * size, page * size).map(row => row.id);
  const watchIds = options.window ? windowIds(filtered, watchPage, watchPageSize) : keywordOptions.map(row => row.id);
  const wishIds = options.window ? [...windowIds(visible, wishPage, wishPageSize), ...windowIds(cancelled, cancelledPage, wishPageSize)] : wishOptions.map(row => row.id);
  const [watchRows, planRows] = await Promise.all([
    prisma.scoutWatch.findMany({ where: { id: { in: watchIds } } }),
    prisma.collectionPlan.findMany({ where: { id: { in: wishIds } }, include: { scoutDetails: true, scoutWatches: true, acquiredCards: { orderBy: { cardId: "asc" }, select: { cardId: true } } } })
  ]);
  const watchMap = new Map(watchRows.map(row => [row.id, row]));
  const planMap = new Map(planRows.map(({ acquiredCards, ...row }) => [row.id, { ...row, acquiredCardIds: acquiredCards.map(link => link.cardId) }]));
  const budgets: Record<string, string> = {};
  for (const row of budgetRows) budgets[row.currency] = (BigInt(budgets[row.currency] ?? "0") + row.budgetMinor!).toString();
  return serialize({ identity: scoutIdentity(), watches: watchIds.map(id => watchMap.get(id)!), plans: wishIds.map(id => planMap.get(id)!), keywordOptions, wishOptions,
    budgets,
    watchPage, watchPageSize, watchCount: filtered.length, wishPage, wishPageSize, wishCount: visible.length, cancelledPage, cancelledCount: cancelled.length });
}
export type ScoutData = Awaited<ReturnType<typeof loadScout>>;
