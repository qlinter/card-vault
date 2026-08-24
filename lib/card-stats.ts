import { selectLatestValuation } from "./financial-history.ts";

const ownedCollectionStatuses = new Set(["holding", "listed", "grading"]);

type ValuationRecord = {
  amountMinor: bigint;
  currency: string;
  valuedAt: Date;
  createdAt: Date;
};

type CardValuationRecord = {
  valuations: ValuationRecord[];
  holdingQuantity?: number;
};

export function isOwnedCollectionStatus(status: string): boolean {
  return ownedCollectionStatuses.has(status);
}

export type LatestValuationTotals = {
  totals: Record<string, bigint>;
  valuedCardCount: number;
};

export function calculateLatestValuationTotals(cards: CardValuationRecord[]): LatestValuationTotals {
  const totals: Record<string, bigint> = {};
  let valuedCardCount = 0;

  for (const card of cards) {
    const latest = selectLatestValuation(card.valuations);
    if (!latest) continue;
    const quantity = Math.max(0, card.holdingQuantity ?? 1);
    if (quantity === 0) continue;
    totals[latest.currency] = (totals[latest.currency] ?? BigInt(0)) + latest.amountMinor * BigInt(quantity);
    valuedCardCount += 1;
  }

  return { totals, valuedCardCount };
}
