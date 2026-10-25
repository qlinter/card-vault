import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { importMatchKey, type ImportMatch } from "./import-matching";

function matchQuery(match: ImportMatch) {
  const where = match.kind === "id" ? Prisma.sql`id=${match.id}` : match.kind === "certificate" ? Prisma.sql`certNumber=${match.certNumber}`
    : Prisma.sql`playerName=${match.playerName} AND cardTitle=${match.cardTitle} AND sport=${match.sport} AND year IS ${match.year} AND parallel IS ${match.parallel} AND serialNumber IS ${match.serialNumber}`;
  // Each branch is bounded even when an archive identity is ambiguous.
  return Prisma.sql`SELECT ${importMatchKey(match)} AS matchKey, id FROM (SELECT id FROM Card WHERE ${where} ORDER BY id LIMIT 2)`;
}

/** One database round trip for up to 100 distinct descriptors, at most 200 IDs. */
export async function loadImportMatchIds(matches: ImportMatch[]): Promise<Map<string, string[]>> {
  const distinct = [...new Map(matches.map(match => [importMatchKey(match), match])).values()];
  if (distinct.length > 100) throw new Error("导入匹配批次超过限制。");
  const grouped = new Map<string, string[]>();
  if (!distinct.length) return grouped;
  const rows = await prisma.$queryRaw<Array<{ matchKey: string; id: string }>>(Prisma.join(distinct.map(matchQuery), " UNION ALL "));
  for (const row of rows) grouped.set(row.matchKey, [...(grouped.get(row.matchKey) || []), row.id]);
  return grouped;
}
