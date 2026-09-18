import type { UpdateExpenseInput, UpdateTransactionInput, UpdateValuationInput } from "./financial-history-store.ts";

function requiredText(formData: FormData, name: string, label: string): string {
  const value = formData.get(name);
  const trimmed = typeof value === "string" ? value.trim() : "";
  if (!trimmed) throw new Error(`${label}不能为空。`);
  return trimmed;
}

export function optionalText(formData: FormData, name: string): string | null {
  const value = formData.get(name);
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed || null;
}

function requiredDate(formData: FormData, name: string): Date {
  const raw = requiredText(formData, name, "日期");
  const date = new Date(`${raw}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw) || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== raw) throw new Error("日期无效。");
  return date;
}

function positiveInteger(formData: FormData, name: string): number {
  const value = Number(requiredText(formData, name, "数量"));
  if (!Number.isInteger(value) || value <= 0) throw new Error("数量必须是正整数。");
  return value;
}

export function transactionInput(formData: FormData): UpdateTransactionInput {
  return {
    kind: requiredText(formData, "kind", "交易类型"),
    amount: requiredText(formData, "amount", "金额"),
    currency: requiredText(formData, "currency", "币种"),
    quantity: positiveInteger(formData, "quantity"),
    secondaryAmount: optionalText(formData, "secondaryAmount"),
    amountKnown: formData.get("amountUnknown") !== "on",
    occurredAt: requiredDate(formData, "occurredAt"),
    source: optionalText(formData, "source"),
    notes: optionalText(formData, "notes")
  };
}

export function expenseInput(formData: FormData): UpdateExpenseInput {
  return {
    kind: requiredText(formData, "kind", "费用类型"),
    context: requiredText(formData, "context", "费用归属"),
    transactionId: optionalText(formData, "transactionId"),
    amount: requiredText(formData, "amount", "金额"),
    currency: requiredText(formData, "currency", "币种"),
    occurredAt: requiredDate(formData, "occurredAt"),
    vendor: optionalText(formData, "vendor"),
    notes: optionalText(formData, "notes")
  };
}

export function valuationInput(formData: FormData): UpdateValuationInput {
  return {
    amount: requiredText(formData, "amount", "金额"),
    currency: requiredText(formData, "currency", "币种"),
    valuedAt: requiredDate(formData, "valuedAt"),
    source: requiredText(formData, "source", "估值来源"),
    notes: optionalText(formData, "notes")
  };
}

