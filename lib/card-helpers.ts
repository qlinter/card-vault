import { Prisma } from "@prisma/client";
import { searchTerms } from "./search-terms.ts";

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
  isSerialNumbered?: string;
  isOneOfOne?: string;
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
  wish?: string;
  sort?: string;
};

function parseTags(value: string): string[] {
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

function addBooleanFilter(parts: Prisma.CardWhereInput[], value: string | undefined, field: "isRookie" | "isSerialNumbered" | "isAutograph" | "isPatch"): void {
  if (value === "true") {
    parts.push({ [field]: true });
  } else if (value === "false") {
    parts.push({ [field]: false });
  }
}

export function buildCardFilters(input: CardFilterInput): Prisma.CardWhereInput {
  const where: Prisma.CardWhereInput = {};
  const andParts: Prisma.CardWhereInput[] = [];

  for (const term of searchTerms(input.q)) {
    andParts.push({
      OR: [
        { playerName: { contains: term } },
        { cardTitle: { contains: term } },
        { sport: { contains: term } },
        { team: { contains: term } },
        { year: { contains: term } },
        { brand: { contains: term } },
        { productLine: { contains: term } },
        { subsetName: { contains: term } },
        { parallel: { contains: term } },
        { cardNumber: { contains: term } },
        { serialNumber: { contains: term } },
        { serialRange: { contains: term } },
        { gradingCompany: { contains: term } },
        { grade: { contains: term } },
        { certNumber: { contains: term } },
        { autoType: { contains: term } },
        { patchType: { contains: term } },
        { transactions: { some: { kind: "purchase", source: { contains: term } } } },
        { tags: { contains: term } },
        { publicDescription: { contains: term } },
        { notes: { contains: term } }
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
  if (input.wish) {
    andParts.push({ acquiredWishes: { some: { planId: input.wish } } });
  }

  addBooleanFilter(andParts, input.isRookie, "isRookie");
  addBooleanFilter(andParts, input.isSerialNumbered, "isSerialNumbered");
  addBooleanFilter(andParts, input.isAutograph, "isAutograph");
  addBooleanFilter(andParts, input.isPatch, "isPatch");

  const oneOfOneRanges = ["1", "/1", "1/1"];
  if (input.isOneOfOne === "true") {
    andParts.push({ serialRange: { in: oneOfOneRanges } });
  } else if (input.isOneOfOne === "false") {
    andParts.push({ OR: [{ serialRange: null }, { serialRange: { notIn: oneOfOneRanges } }] });
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
      return [{ year: "asc" }, { createdAt: "desc" }, { id: "asc" }];
    case "yearDesc":
      return [{ year: "desc" }, { createdAt: "desc" }, { id: "asc" }];
    case "costCnyAsc":
      return [{ report: { remainingCostMinor: { sort: "asc", nulls: "last" } } }, { id: "asc" }];
    case "costCnyDesc":
      return [{ report: { remainingCostMinor: { sort: "desc", nulls: "last" } } }, { id: "asc" }];
    case "valueCnyAsc":
      return [{ report: { valueMinor: { sort: "asc", nulls: "last" } } }, { id: "asc" }];
    case "valueCnyDesc":
      return [{ report: { valueMinor: { sort: "desc", nulls: "last" } } }, { id: "asc" }];
    default:
      return [{ createdAt: "desc" }, { id: "asc" }];
  }
}
