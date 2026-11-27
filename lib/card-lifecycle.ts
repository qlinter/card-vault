import type { Card, CardTransaction, CardExpense, CardValuation } from "@prisma/client";
import { localBusinessDay } from "./financial-business-day.ts";
import { chronologicalTrades } from "./position-accounting.ts";
import { expenseKindLabels, formatHistoryDateInput, valuationSourceLabel } from "./financial-history-presentation.ts";

type Archive = Pick<Card, "createdAt"> & {
  transactions: Pick<CardTransaction, "id" | "kind" | "quantity" | "occurredAt" | "createdAt" | "source">[];
  expenses: Pick<CardExpense, "id" | "kind" | "occurredAt" | "vendor">[];
  valuations: Pick<CardValuation, "id" | "valuedAt" | "source">[];
};

export function cardLifecycle(card: Archive) {
  const events = [{ key: "archive", day: formatHistoryDateInput(localBusinessDay(card.createdAt)), title: "建立档案", note: "", quantity: 0, milestone: true }];
  for (const { record, soldOut, repurchased } of chronologicalTrades(card.transactions)) {
    events.push({ key: "trade-" + record.id, day: formatHistoryDateInput(record.occurredAt),
      title: record.kind === "gift_in" ? "获赠" : record.kind === "gift_out" ? "赠送" : soldOut ? "全部售出" : repurchased ? "再次买入" : record.kind === "sale" ? "卖出" : "买入",
      quantity: record.quantity, note: record.source ?? "", milestone: true });
  }
  for (const expense of card.expenses) events.push({ key: "expense-" + expense.id, day: formatHistoryDateInput(expense.occurredAt),
    title: expense.kind === "grading" ? "记录评级费用" : expenseKindLabels[expense.kind] ?? "其他费用",
    quantity: 0, note: expense.vendor ?? "", milestone: false });
  for (const valuation of card.valuations) events.push({ key: "value-" + valuation.id, day: formatHistoryDateInput(valuation.valuedAt),
    title: "记录估值", quantity: 0, note: valuationSourceLabel(valuation.source), milestone: false });
  return events.reverse().sort((a, b) => b.day.localeCompare(a.day));
}
