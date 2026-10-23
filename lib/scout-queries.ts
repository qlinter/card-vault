import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { searchTerms } from "./search-terms";
import { scoutIdentity } from "./scout-identity";
import { serializeScoutData as serialize } from "./scout-serialization";

export type ScoutPageOptions = { search?: string; wishSearch?: string; wishSort?: string; watchPage?: number; wishPage?: number; cancelledPage?: number; showAcquired?: boolean };

/** Navigation and editor references are read once per workspace, independently of pages. */
export async function loadScoutReferences() {
  const [keywords, wishes] = await prisma.$transaction([
    prisma.scoutWatch.findMany({ orderBy: [{ createdAt: "desc" }, { id: "desc" }], select: { id: true, title: true } }),
    prisma.collectionPlan.findMany({ select: { id: true, title: true, status: true, createdAt: true, targetDate: true, scoutDetails: { select: { priority: true } }, scoutWatches: { select: { watchId: true } } } })
  ]);
  return serialize({ identity: scoutIdentity(), keywordOptions: keywords.map(row => ({ id: row.id, keyword: row.title })), wishOptions: wishes.map(row => ({
    id: row.id, title: row.title, status: row.status, priority: row.scoutDetails?.priority ?? 2,
    createdAt: row.createdAt, targetDate: row.targetDate, watchIds: row.scoutWatches.map(link => link.watchId)
  })) });
}
export type ScoutReferences = Awaited<ReturnType<typeof loadScoutReferences>>;

// Existing databases contain both SQLite text dates and Prisma millisecond dates.
const stamp = (column: Prisma.Sql) => Prisma.sql`CASE WHEN typeof(${column})='integer' THEN ${column} ELSE CAST(strftime('%s',${column}) AS INTEGER)*1000+CAST(substr(strftime('%f',${column}),4,3) AS INTEGER) END`;
const pageNumber = (requested: number | undefined, total: number, size: number) => Math.min(Math.max(1, Math.floor(requested || 1)), Math.max(1, Math.ceil(total / size)));
// JavaScript also folds Kelvin sign and dotted capital I to ASCII search characters.
const fold = (column: Prisma.Sql) => Prisma.sql`replace(replace(lower(${column}),'K','k'),'İ','i'||char(775))`;

export async function loadScoutPage(options: ScoutPageOptions) {
  const watchPageSize = 50, wishPageSize = 20;
  const watchFilter = Prisma.sql`instr(${fold(Prisma.sql`w.title`)}, ${(options.search ?? "").trim().toLowerCase()}) > 0`;
  const terms = searchTerms(options.wishSearch);
  const wishFilter = terms.length ? Prisma.join(terms.map(term => Prisma.sql`(
    instr(${fold(Prisma.sql`p.title`)}, ${term}) > 0 OR instr(${fold(Prisma.sql`coalesce(p.playerName,'')`)}, ${term}) > 0 OR EXISTS (
      SELECT 1 FROM ScoutWishWatch l JOIN ScoutWatch w ON w.id=l.watchId WHERE l.planId=p.id AND instr(${fold(Prisma.sql`w.title`)}, ${term}) > 0
    ))`), " AND ") : Prisma.sql`1=1`;
  const visible = options.showAcquired ? Prisma.sql`p.status IN ('planned','acquired')` : Prisma.sql`p.status='planned'`;
  const created = stamp(Prisma.sql`p.createdAt`), target = stamp(Prisma.sql`p.targetDate`);
  const order = options.wishSort === "recent" ? Prisma.sql`${created} DESC,p.id DESC`
    : options.wishSort === "target" ? Prisma.sql`${target} ASC NULLS LAST,${created} DESC,p.id DESC`
    : Prisma.sql`coalesce(d.priority,2) ASC,${created} DESC,p.id DESC`;
  return prisma.$transaction(async tx => {
    const [counts] = await tx.$queryRaw<Array<{ watches: bigint; wishes: bigint; cancelled: bigint }>>(Prisma.sql`SELECT
      (SELECT count(*) FROM ScoutWatch w WHERE ${watchFilter}) watches,
      (SELECT count(*) FROM CollectionPlan p WHERE ${visible} AND ${wishFilter}) wishes,
      (SELECT count(*) FROM CollectionPlan p WHERE p.status='cancelled' AND ${wishFilter}) cancelled`);
    const watchCount = Number(counts.watches), wishCount = Number(counts.wishes), cancelledCount = Number(counts.cancelled);
    const watchPage = pageNumber(options.watchPage, watchCount, watchPageSize), wishPage = pageNumber(options.wishPage, wishCount, wishPageSize), cancelledPage = pageNumber(options.cancelledPage, cancelledCount, wishPageSize);
    const watchIds = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`SELECT w.id FROM ScoutWatch w WHERE ${watchFilter} ORDER BY ${stamp(Prisma.sql`w.createdAt`)} DESC,w.id DESC LIMIT ${watchPageSize} OFFSET ${(watchPage - 1) * watchPageSize}`);
    const planIds = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`SELECT p.id FROM CollectionPlan p LEFT JOIN ScoutWishDetails d ON d.planId=p.id WHERE ${visible} AND ${wishFilter} ORDER BY ${order} LIMIT ${wishPageSize} OFFSET ${(wishPage - 1) * wishPageSize}`);
    const cancelledIds = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`SELECT p.id FROM CollectionPlan p LEFT JOIN ScoutWishDetails d ON d.planId=p.id WHERE p.status='cancelled' AND ${wishFilter} ORDER BY ${order} LIMIT ${wishPageSize} OFFSET ${(cancelledPage - 1) * wishPageSize}`);
    const ids = [...planIds, ...cancelledIds].map(row => row.id);
    const watches = await tx.scoutWatch.findMany({ where: { id: { in: watchIds.map(row => row.id) } } });
    const plans = await tx.collectionPlan.findMany({ where: { id: { in: ids } }, include: { scoutDetails: true, scoutWatches: true, acquiredCards: { orderBy: { cardId: "asc" }, select: { cardId: true } } } });
    const watchMap = new Map(watches.map(row => [row.id, row]));
    const planMap = new Map(plans.map(({ acquiredCards, ...row }) => [row.id, { ...row, acquiredCardIds: acquiredCards.map(link => link.cardId) }]));
    const budgets: Record<string, string> = {};
    // BigInt accumulation preserves budgets beyond SQLite SUM's signed 64-bit limit.
    for (const row of await tx.collectionPlan.findMany({ where: { status: "planned", budgetMinor: { not: null } }, select: { currency: true, budgetMinor: true } })) {
      budgets[row.currency] = (BigInt(budgets[row.currency] ?? "0") + row.budgetMinor!).toString();
    }
    return serialize({ identity: scoutIdentity(), watches: watchIds.map(row => watchMap.get(row.id)!), plans: ids.map(id => planMap.get(id)!),
      keywordOptions: [] as ScoutReferences["keywordOptions"], wishOptions: [] as ScoutReferences["wishOptions"], budgets,
      watchPage, watchPageSize, watchCount, wishPage, wishPageSize, wishCount, cancelledPage, cancelledCount });
  }, { timeout: 15000 });
}
