import { Prisma } from "@prisma/client";

export const homeCardInclude = Prisma.validator<Prisma.CardInclude>()({
  _count: { select: { images: true } },
  images: { take: 1, orderBy: { createdAt: "asc" } },
  valuations: {
    select: { amountMinor: true, currency: true, valuedAt: true, createdAt: true, source: true },
    orderBy: [{ valuedAt: "desc" }, { createdAt: "desc" }],
    take: 1
  }
});

export const portfolioAnalysisCardSelect = Prisma.validator<Prisma.CardSelect>()({
  playerName: true,
  cardTitle: true,
  sport: true,
  team: true,
  year: true,
  brand: true,
  productLine: true,
  subsetName: true,
  parallel: true,
  cardNumber: true,
  isSerialNumbered: true,
  serialNumber: true,
  serialRange: true,
  collectionStatus: true,
  gradingCompany: true,
  grade: true,
  isRookie: true,
  isAutograph: true,
  autoType: true,
  isPatch: true,
  patchType: true,
  tags: true,
  publicDescription: true,
  _count: { select: { images: true } },
  transactions: { select: { kind: true, amountMinor: true, currency: true, occurredAt: true, createdAt: true } },
  expenses: { select: { amountMinor: true, currency: true, occurredAt: true } },
  valuations: { select: { amountMinor: true, currency: true, valuedAt: true, createdAt: true, source: true } }
});
