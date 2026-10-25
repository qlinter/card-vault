import { Prisma } from "@prisma/client";

export type ShowcaseQuery = {
  q?: string;
  group?: string;
  page?: number;
};

export const SHOWCASE_PAGE_SIZE = 48;

export function parseShowcasePage(value: string | undefined): number {
  if (!value || !/^[1-9]\d*$/.test(value)) return 1;
  const page = Number(value);
  return Number.isSafeInteger(page) ? page : 1;
}

export function showcasePageForIndex(index: number): number {
  return Math.floor(index / SHOWCASE_PAGE_SIZE) + 1;
}

export function toShowcaseWhere(input: ShowcaseQuery): Prisma.CardWhereInput {
  const andParts: Prisma.CardWhereInput[] = [];

  if (input.group) {
    andParts.push({ playerName: input.group });
  }

  if (input.q) {
    andParts.push({
      OR: [
        { playerName: { contains: input.q } },
        { cardTitle: { contains: input.q } },
        { team: { contains: input.q } },
        { productLine: { contains: input.q } },
        { cardNumber: { contains: input.q } },
        { tags: { contains: input.q } },
        { sport: { contains: input.q } },
        { year: { contains: input.q } },
        { grade: { contains: input.q } }
      ]
    });
  }

  return andParts.length > 0 ? { AND: andParts } : {};
}

export function normalizeGroupName(value: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

const hanCharacter = /\p{Script=Han}/u;
const englishGroupCollator = new Intl.Collator("en", { numeric: true, sensitivity: "base" });
const chineseGroupCollator = new Intl.Collator("zh-CN", { numeric: true, sensitivity: "base" });

export function compareShowcaseGroupNames(left: string, right: string): number {
  const leftHasHan = hanCharacter.test(left);
  const rightHasHan = hanCharacter.test(right);
  if (leftHasHan !== rightHasHan) return leftHasHan ? 1 : -1;
  const compared = (leftHasHan ? chineseGroupCollator : englishGroupCollator).compare(left, right);
  return compared || (left < right ? -1 : left > right ? 1 : 0);
}

function showcaseQuerySuffix(query: ShowcaseQuery): string {
  const params = new URLSearchParams();

  if (query.group) {
    params.set("group", query.group);
  }
  if (query.q) {
    params.set("q", query.q);
  }
  if (query.page && query.page > 1) {
    params.set("page", String(query.page));
  }

  return params.toString();
}

export function buildShowcaseHref(query: ShowcaseQuery): string {
  const suffix = showcaseQuerySuffix(query);
  return suffix ? `/showcase?${suffix}` : "/showcase";
}

export function buildShowcaseCardHref(cardId: string, query: ShowcaseQuery, basePath = "/showcase/cards"): string {
  const suffix = showcaseQuerySuffix(query);
  return suffix ? `${basePath}/${cardId}?${suffix}` : `${basePath}/${cardId}`;
}

const searchableColumns = ["playerName", "cardTitle", "team", "productLine", "cardNumber", "tags", "sport", "year", "grade"] as const;

/** Mirrors toShowcaseWhere for bounded rank/neighbor queries against raw SQLite timestamps. */
export function showcaseSqlScope(query: ShowcaseQuery): Prisma.Sql {
  const clauses: Prisma.Sql[] = [Prisma.sql`1=1`];
  if (query.group) clauses.push(Prisma.sql`candidate.playerName = ${query.group}`);
  if (query.q) {
    const pattern = `%${query.q}%`;
    clauses.push(Prisma.sql`(${Prisma.join(searchableColumns.map(column => Prisma.sql`${Prisma.raw(`candidate.${column}`)} LIKE ${pattern}`), " OR ")})`);
  }
  return Prisma.sql`${Prisma.join(clauses, " AND ")}`;
}

