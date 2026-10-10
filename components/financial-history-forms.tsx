"use client";

import { PersistentForm, type PersistentFormAction } from "./persistent-form";
import { UiText } from "@/components/ui-text";
import type { CardExpense, CardTransaction, CardValuation } from "@prisma/client";
import { useEffect, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { FinancialRecordFields } from "./financial-record-fields";
import type { EntryFinanceRecord, EntryFinanceValues } from "@/lib/card-entry-finance";
import { formatMinorMoney } from "@/lib/financial-history";
import { formatHistoryDateInput } from "@/lib/financial-history-presentation";

type SharedFormProps = {
  action: PersistentFormAction;
  submitLabel: string;
  marker?: string;
};

function amountInput(amountMinor: bigint, currency: string): string {
  return formatMinorMoney(amountMinor, currency).replace(`${currency} `, "");
}

function FormMarker({ value }: { value?: string }) {
  const [submissionId, setSubmissionId] = useState("");
  useEffect(() => { setSubmissionId(crypto.randomUUID()); }, []);
  return <>{value ? <input type="hidden" name="recordMarker" value={value} /> : null}<input type="hidden" name="submissionId" value={submissionId} /></>;
}

function HistorySubmit({ editing, label }: { editing: boolean; label: string }) {
  const { pending } = useFormStatus();
  return <button className={editing ? "btn btn-secondary" : "btn btn-primary"} type="submit" disabled={pending}><UiText text={label} /></button>;
}

function HistoryRecordForm({ action, submitLabel, marker, type, values, editing, sales = [] }: SharedFormProps & {
  type: EntryFinanceRecord["type"];
  values: EntryFinanceValues;
  editing: boolean;
  sales?: Array<{ id: string; label: ReactNode }>;
}) {
  return <PersistentForm action={action} className="financial-form">
    <FormMarker value={marker} />
    <FinancialRecordFields type={type} values={values} prefix="" sales={sales} showExpenseHelp />
    <HistorySubmit editing={editing} label={submitLabel} />
  </PersistentForm>;
}

export function TransactionForm({ record, ...props }: SharedFormProps & { record?: CardTransaction }) {
  return <HistoryRecordForm {...props} type="transaction" editing={Boolean(record)} values={{
    kind: record?.kind ?? "purchase",
    amount: record ? amountInput(record.amountMinor, record.currency) : "",
    currency: record?.currency ?? "CNY",
    quantity: String(record?.quantity ?? 1),
    occurredAt: formatHistoryDateInput(record?.occurredAt),
    source: record?.source ?? "",
    notes: record?.notes ?? ""
  }} />;
}

export function ExpenseForm({ record, transactions, ...props }: SharedFormProps & { record?: CardExpense; transactions: CardTransaction[] }) {
  const sales = transactions.filter(transaction => transaction.kind === "sale").map(sale => ({
    id: sale.id,
    label: <>{formatHistoryDateInput(sale.occurredAt)} · {sale.quantity}<UiText text=" 张 · " />{formatMinorMoney(sale.amountMinor, sale.currency)}</>
  }));
  return <HistoryRecordForm {...props} type="expense" editing={Boolean(record)} sales={sales} values={{
    kind: record?.kind ?? "grading",
    context: record?.context ?? "grading",
    amount: record ? amountInput(record.amountMinor, record.currency) : "",
    currency: record?.currency ?? "CNY",
    occurredAt: formatHistoryDateInput(record?.occurredAt),
    vendor: record?.vendor ?? "",
    transactionId: record?.transactionId ?? "",
    notes: record?.notes ?? ""
  }} />;
}

export function ValuationForm({ record, ...props }: SharedFormProps & { record?: CardValuation }) {
  return <HistoryRecordForm {...props} type="valuation" editing={Boolean(record)} values={{
    amount: record ? amountInput(record.amountMinor, record.currency) : "",
    currency: record?.currency ?? "CNY",
    valuedAt: formatHistoryDateInput(record?.valuedAt),
    source: record?.source ?? "个人估计",
    notes: record?.notes ?? ""
  }} />;
}
