import type { PortfolioCardRecord } from "../../lib/portfolio-analysis-types.ts";
const date = (month: number) => new Date(Date.UTC(2023, month, 5));
export function denseHistoryCards(count = 100, quotes = 240): PortfolioCardRecord[] {
  return Array.from({length: count}, (_,i) => ({
    id: `history-${i}`, playerName: "Fixture", sport: "Basketball", gradingCompany: null, grade: null,
    isRookie: false, isAutograph: false, isPatch: false, createdAt: date(10),
    collectionStatus: i % 7 === 0 ? "pending_grading" : i % 5 === 0 ? "sold" : "holding", holdingQuantity: 2,
    transactions: i % 11 === 0 ? [] : [
      { kind: "sale", quantity: i % 5 === 0 ? 3 : 1, amountMinor: 17431n, currency: "USD", occurredAt: date(30), createdAt: date(32) },
      { kind: "purchase", quantity: 3, amountMinor: BigInt(10001 + i), currency: "CNY", occurredAt: date(0), createdAt: date(1), amountKnown: i % 13 !== 0,
        paymentsJson: i % 3 === 0 ? '[{"currency":"USD","amountMinor":"211"}]' : null }
    ],
    expenses: Array.from({length: 12}, (_,j) => ({ amountMinor: BigInt(99 + j), currency: j % 2 ? "CNY" : "USD", occurredAt: date(j*3-1), createdAt: date(j*3), context: j % 4 === 0 ? "sale" : "grading", amountKnown: i % 17 !== 0 })),
    valuations: Array.from({length:quotes}, (_,j) => ({ amountMinor: BigInt(10111+j), currency: j % 3 ? "CNY" : "USD", valuedAt: date((j*17)%45), createdAt: date((j*11)%45), source: "个人估计", available: j % 19 !== 0 }))
  }));
}
