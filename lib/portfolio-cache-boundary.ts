import type { PortfolioCardRecord } from "./portfolio-analysis-types.ts";
import { stalePortfolioValuationDays } from "./portfolio-quality.ts";
const day = 86400000;

export function createPortfolioCacheBoundary(asOf: Date) {
  const start = asOf.getTime();
  let until = Math.min(start + 60000, Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), asOf.getUTCDate() + 1));
  const consider = (time: number) => { if (Number.isFinite(time) && time > start) until = Math.min(until, time); };
  function add(cards: PortfolioCardRecord[]) {
    for (const card of cards) {
      if (card.createdAt) consider(card.createdAt.getTime());
      const times = [...card.transactions, ...card.expenses].map(row => (row.occurredAt || row.createdAt)?.getTime() ?? 0);
      for (const row of card.valuations) {
        const time = row.valuedAt.getTime(); times.push(time);
        for (const days of [30, 90, 180]) consider(time + days * day);
        consider(time + stalePortfolioValuationDays * day + 1);
      }
      for (const time of times) {
        consider(time);
        if (time <= start) consider(time + (Math.floor((start - time) / day) + 1) * day);
      }
    }
  }
  return { add, expiresAt: () => until };
}
