"use client";

import { PersistentForm, type PersistentFormAction } from "./persistent-form";
import { UiText } from "@/components/ui-text";
import type { CardExpense, CardTransaction, CardValuation } from "@prisma/client";
import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { paymentComponents } from "@/lib/financial-reporting";
import { useLanguage } from "./language-provider";
import { ExpenseKindSelect, HistoryCurrencySelect, ValuationSourceSelect } from "@/components/financial-history-selects";
import { formatMinorMoney } from "@/lib/financial-history";
import {
  expenseContextDescriptions,
  expenseContextInputLabels,
  formatHistoryDateInput
} from "@/lib/financial-history-presentation";

type FormAction = PersistentFormAction;

type SharedFormProps = {
  action: FormAction;
  submitLabel: string;
  marker?: string;
};

function amountInput(amountMinor: bigint, currency: string): string {
  return formatMinorMoney(amountMinor, currency).replace(`${currency} `, "");
}

function CurrencyField({ value = "CNY" }: { value?: string }) {
  return (
    <label className="field">
      <span><UiText text={"币种"} /></span>
      <HistoryCurrencySelect name="currency" defaultValue={value} />
    </label>
  );
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

export function TransactionForm({
  action,
  submitLabel,
  marker,
  record
}: SharedFormProps & { record?: CardTransaction }) {
  const { locale } = useLanguage();
  const text = (zh: string, en: string) => locale === "en" ? en : zh;
  const [currency, setCurrency] = useState(record?.currency ?? "CNY");
  const secondary = record ? paymentComponents(record)[1] : null;
  return (
    <PersistentForm action={action} className="financial-form">
      <FormMarker value={marker} />
      <label className="field"><span><UiText text={"类型"} /></span><select name="kind" defaultValue={record?.kind ?? "purchase"}><option value="purchase"><UiText text={"购入"} /></option><option value="sale"><UiText text={"售出"} /></option></select></label>
      <label className="field"><span><UiText text={"金额"} /></span><input name="amount" inputMode="decimal" defaultValue={record ? amountInput(record.amountMinor, record.currency) : undefined} required /></label>
      <label className="field"><span><UiText text={"币种"} /></span><select name="currency" value={currency} onChange={(event) => setCurrency(event.target.value)}><option value="CNY">CNY</option><option value="USD">USD</option></select></label>
      <label className="field" data-i18n-skip><span>{text("另一币种付款 / 收款（可选）", "Additional payment / receipt (optional)")} · {currency === "CNY" ? "USD" : "CNY"}</span><input name="secondaryAmount" inputMode="decimal" defaultValue={secondary ? amountInput(secondary.amountMinor, secondary.currency) : ""} /></label>
      <label className="field" data-i18n-skip><span><input type="checkbox" name="amountUnknown" defaultChecked={record?.amountKnown === false} /> {text("金额尚不完整（已知零成本请勿勾选）", "Amount incomplete (leave unchecked for a known zero cost)")}</span></label>
      <label className="field"><span><UiText text={"数量"} /></span><input name="quantity" type="number" min="1" defaultValue={record?.quantity ?? 1} required /></label>
      <label className="field"><span><UiText text={"日期"} /></span><input name="occurredAt" type="date" defaultValue={formatHistoryDateInput(record?.occurredAt)} required /></label>
      <label className="field"><span><UiText text={"渠道 / 来源"} /></span><input name="source" defaultValue={record?.source ?? ""} /></label>
      <label className="field full"><span><UiText text={"备注"} /></span><textarea name="notes" defaultValue={record?.notes ?? ""} /></label>
      <HistorySubmit editing={Boolean(record)} label={submitLabel} />
    </PersistentForm>
  );
}

function SaleTransactionField({ transactions, value }: { transactions: CardTransaction[]; value?: string | null }) {
  const sales = transactions.filter((transaction) => transaction.kind === "sale");
  return (
    <label className="field full">
      <span><UiText text={"关联出售记录"} /></span>
      <select name="transactionId" defaultValue={value ?? ""} required>
        <option value=""><UiText text={"请选择"} /></option>
        {sales.map((sale) => (
          <option key={sale.id} value={sale.id}>
            {formatHistoryDateInput(sale.occurredAt)} · {sale.quantity}<UiText text={" 张 · "} />{formatMinorMoney(sale.amountMinor, sale.currency)}
          </option>
        ))}
      </select>
      {sales.length === 0 ? <small className="field-help"><UiText text={"请先新增一笔出售交易。"} /></small> : null}
    </label>
  );
}

export function ExpenseForm({
  action,
  submitLabel,
  marker,
  record,
  transactions
}: SharedFormProps & { record?: CardExpense; transactions: CardTransaction[] }) {
  const [context, setContext] = useState(record?.context ?? "grading");
  return (
    <PersistentForm action={action} className="financial-form">
      <FormMarker value={marker} />
      <label className="field full">
        <span><UiText text={"费用归属"} /></span>
        <select name="context" value={context} onChange={(event) => setContext(event.target.value)}>
          <option value="purchase"><UiText text={expenseContextInputLabels.purchase} /></option>
          <option value="grading"><UiText text={expenseContextInputLabels.grading} /></option>
          <option value="sale"><UiText text={expenseContextInputLabels.sale} /></option>
        </select>
        <small className="field-help"><UiText text={expenseContextDescriptions[context]} /></small>
      </label>
      <label className="field"><span><UiText text={"费用类型"} /></span><ExpenseKindSelect name="kind" defaultValue={record?.kind ?? "grading"} /></label>
      <label className="field"><span><UiText text={"金额"} /></span><input name="amount" inputMode="decimal" defaultValue={record ? amountInput(record.amountMinor, record.currency) : undefined} required /></label>
      <CurrencyField value={record?.currency === "USD" ? "USD" : "CNY"} />
      <label className="field"><span><UiText text={"日期"} /></span><input name="occurredAt" type="date" defaultValue={formatHistoryDateInput(record?.occurredAt)} required /></label>
      <label className="field"><span><UiText text={"服务方"} /></span><input name="vendor" defaultValue={record?.vendor ?? ""} /></label>
      {context === "sale" ? <SaleTransactionField transactions={transactions} value={record?.transactionId} /> : null}
      <label className="field full"><span><UiText text={"备注"} /></span><textarea name="notes" defaultValue={record?.notes ?? ""} /></label>
      <HistorySubmit editing={Boolean(record)} label={submitLabel} />
    </PersistentForm>
  );
}

export function ValuationForm({
  action,
  submitLabel,
  marker,
  record
}: SharedFormProps & { record?: CardValuation }) {
  return (
    <PersistentForm action={action} className="financial-form">
      <FormMarker value={marker} />
      <label className="field"><span><UiText text={"单张估值"} /></span><input name="amount" inputMode="decimal" defaultValue={record ? amountInput(record.amountMinor, record.currency) : undefined} required /></label>
      <CurrencyField value={record?.currency === "USD" ? "USD" : "CNY"} />
      <label className="field"><span><UiText text={"估值日期"} /></span><input name="valuedAt" type="date" defaultValue={formatHistoryDateInput(record?.valuedAt)} required /></label>
      <label className="field"><span><UiText text={"估值来源 *"} /></span><ValuationSourceSelect name="source" defaultValue={record?.source ?? "个人估计"} required /></label>
      <label className="field full"><span><UiText text={"备注"} /></span><textarea name="notes" defaultValue={record?.notes ?? ""} /></label>
      <HistorySubmit editing={Boolean(record)} label={submitLabel} />
    </PersistentForm>
  );
}
