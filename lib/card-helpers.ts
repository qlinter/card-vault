import { Prisma } from "@prisma/client";

type CardFilterInput = {
  q?: string;
  sport?: string;
  team?: string;
  year?: string;
  setName?: string;
  isAutograph?: string;
  isSerialNumbered?: string;
  isGraded?: string;
  sort?: string;
};

export function parseTags(value: string): string[] {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export function stringifyTags(tags: string[] | null | undefined): string {
  return (tags ?? []).join(", ");
}

export function splitTagString(value: string | null): string[] {
  if (!value) {
    return [];
  }

  return parseTags(value);
}

export function buildCardFilters(input: CardFilterInput): Prisma.CardWhereInput {
  const where: Prisma.CardWhereInput = {};
  const andParts: Prisma.CardWhereInput[] = [];

  if (input.q) {
    andParts.push({
      OR: [
        { playerName: { contains: input.q } },
        { cardTitle: { contains: input.q } },
        { setName: { contains: input.q } },
        { team: { contains: input.q } },
        { cardNumber: { contains: input.q } },
        { tags: { contains: input.q } },
        { year: { contains: input.q } },
        { grade: { contains: input.q } }
      ]
    });
  }

  if (input.sport) {
    andParts.push({ sport: input.sport });
  }
  if (input.team) {
    andParts.push({ team: input.team });
  }
  if (input.year) {
    andParts.push({ year: input.year });
  }
  if (input.setName) {
    andParts.push({ setName: input.setName });
  }
  if (input.isAutograph === "true") {
    andParts.push({ isAutograph: true });
  } else if (input.isAutograph === "false") {
    andParts.push({ isAutograph: false });
  }
  if (input.isSerialNumbered === "true") {
    andParts.push({ isSerialNumbered: true });
  } else if (input.isSerialNumbered === "false") {
    andParts.push({ isSerialNumbered: false });
  }
  if (input.isGraded === "true") {
    andParts.push({ grade: { not: null } });
  } else if (input.isGraded === "false") {
    andParts.push({ grade: null });
  }

  if (andParts.length > 0) {
    where.AND = andParts;
  }

  return where;
}

export function buildCardSorting(sort?: string): Prisma.CardOrderByWithRelationInput[] {
  switch (sort) {
    case "yearAsc":
      return [{ year: "asc" }, { createdAt: "desc" }];
    case "yearDesc":
      return [{ year: "desc" }, { createdAt: "desc" }];
    case "priceAsc":
      return [{ purchasePrice: "asc" }, { createdAt: "desc" }];
    case "priceDesc":
      return [{ purchasePrice: "desc" }, { createdAt: "desc" }];
    case "gradeAsc":
      return [{ grade: "asc" }, { createdAt: "desc" }];
    case "gradeDesc":
      return [{ grade: "desc" }, { createdAt: "desc" }];
    default:
      return [{ createdAt: "desc" }];
  }
}
