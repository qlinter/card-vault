import { Prisma } from "@prisma/client";

type CardFilterInput = {
  q?: string;
  sport?: string;
  team?: string;
  year?: string;
  brand?: string;
  productLine?: string;
  subsetName?: string;
  parallel?: string;
  cardNumber?: string;
  serialNumber?: string;
  serialRange?: string;
  isRookie?: string;
  isAutograph?: string;
  autoType?: string;
  isPatch?: string;
  patchType?: string;
  isGraded?: string;
  gradingCompany?: string;
  grade?: string;
  certNumber?: string;
  visibility?: string;
  collectionStatus?: string;
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

function addBooleanFilter(parts: Prisma.CardWhereInput[], value: string | undefined, field: "isRookie" | "isAutograph" | "isPatch"): void {
  if (value === "true") {
    parts.push({ [field]: true });
  } else if (value === "false") {
    parts.push({ [field]: false });
  }
}

export function buildCardFilters(input: CardFilterInput): Prisma.CardWhereInput {
  const where: Prisma.CardWhereInput = {};
  const andParts: Prisma.CardWhereInput[] = [];

  if (input.q) {
    andParts.push({
      OR: [
        { playerName: { contains: input.q } },
        { cardTitle: { contains: input.q } },
        { sport: { contains: input.q } },
        { team: { contains: input.q } },
        { year: { contains: input.q } },
        { brand: { contains: input.q } },
        { productLine: { contains: input.q } },
        { subsetName: { contains: input.q } },
        { parallel: { contains: input.q } },
        { cardNumber: { contains: input.q } },
        { serialNumber: { contains: input.q } },
        { serialRange: { contains: input.q } },
        { gradingCompany: { contains: input.q } },
        { grade: { contains: input.q } },
        { certNumber: { contains: input.q } },
        { autoType: { contains: input.q } },
        { patchType: { contains: input.q } },
        { purchaseSource: { contains: input.q } },
        { tags: { contains: input.q } },
        { publicDescription: { contains: input.q } },
        { notes: { contains: input.q } }
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
  if (input.brand) {
    andParts.push({ brand: input.brand });
  }
  if (input.productLine) {
    andParts.push({ productLine: input.productLine });
  }
  if (input.subsetName) {
    andParts.push({ subsetName: input.subsetName });
  }
  if (input.parallel) {
    andParts.push({ parallel: input.parallel });
  }
  if (input.cardNumber) {
    andParts.push({ cardNumber: { contains: input.cardNumber } });
  }
  if (input.serialNumber) {
    andParts.push({ serialNumber: { contains: input.serialNumber } });
  }
  if (input.serialRange) {
    andParts.push({ serialRange: { contains: input.serialRange } });
  }
  if (input.autoType) {
    andParts.push({ autoType: input.autoType });
  }
  if (input.patchType) {
    andParts.push({ patchType: input.patchType });
  }
  if (input.gradingCompany) {
    andParts.push({ gradingCompany: input.gradingCompany });
  }
  if (input.grade) {
    andParts.push({ grade: input.grade });
  }
  if (input.certNumber) {
    andParts.push({ certNumber: { contains: input.certNumber } });
  }
  if (input.visibility) {
    andParts.push({ visibility: input.visibility });
  }
  if (input.collectionStatus) {
    andParts.push({ collectionStatus: input.collectionStatus });
  }

  addBooleanFilter(andParts, input.isRookie, "isRookie");
  addBooleanFilter(andParts, input.isAutograph, "isAutograph");
  addBooleanFilter(andParts, input.isPatch, "isPatch");

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
    default:
      return [{ createdAt: "desc" }];
  }
}
