import { Prisma } from "@prisma/client";

export type ShowcaseQuery = {
  q?: string;
  group?: string;
};

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
        { setName: { contains: input.q } },
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

export function buildShowcaseCardHref(cardId: string, query: ShowcaseQuery, basePath = "/showcase/cards"): string {
  const params = new URLSearchParams();

  if (query.group) {
    params.set("group", query.group);
  }
  if (query.q) {
    params.set("q", query.q);
  }

  const suffix = params.toString();
  return suffix ? `${basePath}/${cardId}?${suffix}` : `${basePath}/${cardId}`;
}
