import type { PortfolioSnapshot } from "./portfolio-analysis-types.ts";

/** Saved snapshots without an explicit population retain their original scope. */
export function portfolioValuationEligibleCount(snapshot: Pick<PortfolioSnapshot, "cardCount" | "financials">): number {
  return snapshot.financials.valuationEligibleCount ?? snapshot.cardCount;
}
