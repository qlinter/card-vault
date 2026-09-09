import { Prisma } from "@prisma/client";

// Rebuilding financial reports does not need card text or image records.
export const financialCardSelect = Prisma.validator<Prisma.CardSelect>()({
  id: true, collectionStatus: true, holdingQuantity: true,
  transactions: { select: { kind: true, amountMinor: true, currency: true, quantity: true, occurredAt: true, createdAt: true, paymentsJson: true, amountKnown: true } },
  expenses: { select: { context: true, amountMinor: true, currency: true, occurredAt: true, createdAt: true } },
  valuations: { select: { amountMinor: true, currency: true, valuedAt: true, createdAt: true, source: true } }
});

export const portfolioAnalysisCardSelect = Prisma.validator<Prisma.CardSelect>()({
  id: true,
  createdAt: true,
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
  holdingQuantity: true,
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
  transactions: financialCardSelect.transactions,
  expenses: { select: { kind: true, context: true, amountMinor: true, currency: true, occurredAt: true, createdAt: true } },
  valuations: financialCardSelect.valuations
});
