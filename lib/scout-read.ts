import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { matchesSearch, searchTerms } from "./search-terms";
import { scoutIdentity } from "./scout-identity";
import { serializeScoutData } from "./scout-serialization";
import { ensureScoutReady } from "./scout-ready";

const pageSize = 20;
const fold = (column: Prisma.Sql) => Prisma.sql`replace(replace(lower(${column}),'K','k'),'İ','i'||char(775))`;
export async function loadScout(options: { search?: string; page?: number } = {}) {
  ensureScoutReady();
  const search = options.search ?? "";
  const casedUnicode = [...search].some(char => char.codePointAt(0)! > 127 && char.toUpperCase() !== char.toLowerCase());
  return prisma.$transaction(async tx => {
    const matching = casedUnicode ? (await tx.collectionPlan.findMany({ select: { id: true, title: true, playerName: true, notes: true } }))
      .filter(row => matchesSearch([row.title, row.playerName, row.notes].filter(Boolean).join(" "), search)).map(row => row.id) : null;
    const terms = searchTerms(search);
    const filter = matching ? (matching.length ? Prisma.sql`p.id IN (${Prisma.join(matching)})` : Prisma.sql`0=1`) : terms.length ? Prisma.join(terms.map(term => Prisma.sql`(instr(${fold(Prisma.sql`p.title`)},${term})>0 OR instr(${fold(Prisma.sql`coalesce(p.playerName,'')`)},${term})>0 OR instr(${fold(Prisma.sql`coalesce(p.notes,'')`)},${term})>0)`), " AND ") : Prisma.sql`1=1`;
    const [result] = await tx.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`SELECT count(*) count FROM CollectionPlan p WHERE ${filter}`);
    const count = Number(result.count);
    const page = Math.min(Math.max(1, Math.floor(options.page || 1)), Math.max(1, Math.ceil(count / pageSize)));
    const ids = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`SELECT p.id FROM CollectionPlan p WHERE ${filter} ORDER BY CASE WHEN typeof(p.createdAt)='integer' THEN p.createdAt ELSE CAST(strftime('%s',p.createdAt) AS INTEGER)*1000 END DESC,p.id DESC LIMIT ${pageSize} OFFSET ${(page-1)*pageSize}`);
    const rows = await tx.collectionPlan.findMany({
      where: { id: { in: ids.map(row => row.id) } },
      select: { id: true, title: true, playerName: true, budgetMinor: true, currency: true, notes: true, createdAt: true, updatedAt: true }
    });
    const index = new Map(rows.map(row => [row.id, row]));
    return serializeScoutData({ identity: scoutIdentity(), plans: ids.map(row => index.get(row.id)!), page, pageSize, count });
  });
}
export type ScoutData = Awaited<ReturnType<typeof loadScout>>;
