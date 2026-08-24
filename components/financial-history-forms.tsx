"use client";

import type { CardExpense, CardTransaction, CardValuation } from "@prisma/client";
import { useState } from "react";
import { HistoryCurrencySelect, ValuationSourceSelect } from "@/components/financial-history-selects";
import { formatMinorMoney } from "@/lib/financial-history";
import {
  expenseContextDescriptions,
  expenseContextInputLabels,
  formatHistoryDateInput
} from "@/lib/financial-history-presentation";

type FormAction = (formData: FormData) => void | Promise<void>;

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
      <span>币种</span>
      <HistoryCurrencySelect name="currency" defaultValue={value} />
    </label>
  );
}

function FormMarker({ value }: { value?: string }) {
  return value ? <input type="hidden" name="recordMarker" value={value} /> : null;
}

export function TransactionForm({
  action,
  submitLabel,
  marker,
  record
}: SharedFormProps & { record?: CardTransaction }) {
  return (
    <form action={action} className="financial-form">
      <FormMarker value={marker} />
      <label className="field"><span>类型</span><select name="kind" defaultValue={record?.kind ?? "purchase"}><option value="purchase">购入</option><option value="sale">售出</option></select></label>
      <label className="field"><span>金额</span><input name="amount" inputMode="decimal" defaultValue={record ? amountInput(record.amountMinor, record.currency) : undefined} required /></label>
      <CurrencyField value={record?.currency === "USD" ? "USD" : "CNY"} />
      <label className="field"><span>数量</span><input name="quantity" type="number" min="1" defaultValue={record?.quantity ?? 1} required /></label>
      <label className="field"><span>日期</span><input name="occurredAt" type="date" defaultValue={formatHistoryDateInput(record?.occurredAt)} required /></label>
      <label className="field"><span>渠道 / 来源</span><input name="source" defaultValue={record?.source ?? ""} /></label>
      <label className="field full"><span>备注</span><textarea name="notes" defaultValue={record?.notes ?? ""} /></label>
      <button className={record ? "btn btn-secondary" : "btn btn-primary"} type="submit">{submitLabel}</button>
    </form>
  );
}

function SaleTransactionField({ transactions, value }: { transactions: CardTransaction[]; value?: string | null }) {
  const sales = transactions.filter((transaction) => transaction.kind === "sale");
  return (
    <label className="field full">
      <span>关联出售记录</span>
      <select name="transactionId" defaultValue={value ?? ""} required>
        <option value="">请选择</option>
        {sales.map((sale) => (
          <option key={sale.id} value={sale.id}>
            {formatHistoryDateInput(sale.occurredAt)} · {sale.quantity} 张 · {formatMinorMoney(sale.amountMinor, sale.currency)}
          </option>
        ))}
      </select>
      {sales.length === 0 ? <small className="field-help">请先新增一笔出售交易。</small> : null}
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
    <form action={action} className="financial-form">
      <FormMarker value={marker} />
      <label className="field full">
        <span>费用归属</span>
        <select name="context" value={context} onChange={(event) => setContext(event.target.value)}>
          <option value="purchase">{expenseContextInputLabels.purchase}</option>
          <option value="grading">{expenseContextInputLabels.grading}</option>
          <option value="sale">{expenseContextInputLabels.sale}</option>
        </select>
        <small className="field-help">{expenseContextDescriptions[context]}</small>
      </label>
      <label className="field"><span>费用类型</span><select name="kind" defaultValue={record?.kind ?? "grading"}><option value="grading">评级费</option><option value="shipping">运费</option><option value="tax">税费</option><option value="insurance">保险费</option><option value="storage">存储费</option><option value="marketplace_fee">平台费用</option><option value="other">其他费用</option></select></label>
      <label className="field"><span>金额</span><input name="amount" inputMode="decimal" defaultValue={record ? amountInput(record.amountMinor, record.currency) : undefined} required /></label>
      <CurrencyField value={record?.currency === "USD" ? "USD" : "CNY"} />
      <label className="field"><span>日期</span><input name="occurredAt" type="date" defaultValue={formatHistoryDateInput(record?.occurredAt)} required /></label>
      <label className="field"><span>服务方</span><input name="vendor" defaultValue={record?.vendor ?? ""} /></label>
      {context === "sale" ? <SaleTransactionField transactions={transactions} value={record?.transactionId} /> : null}
      <label className="field full"><span>备注</span><textarea name="notes" defaultValue={record?.notes ?? ""} /></label>
      <button className={record ? "btn btn-secondary" : "btn btn-primary"} type="submit">{submitLabel}</button>
    </form>
  );
}

export function ValuationForm({
  action,
  submitLabel,
  marker,
  record
}: SharedFormProps & { record?: CardValuation }) {
  return (
    <form action={action} className="financial-form">
      <FormMarker value={marker} />
      <label className="field"><span>单张估值</span><input name="amount" inputMode="decimal" defaultValue={record ? amountInput(record.amountMinor, record.currency) : undefined} required /></label>
      <CurrencyField value={record?.currency === "USD" ? "USD" : "CNY"} />
      <label className="field"><span>估值日期</span><input name="valuedAt" type="date" defaultValue={formatHistoryDateInput(record?.valuedAt)} required /></label>
      <label className="field"><span>估值来源 *</span><ValuationSourceSelect name="source" defaultValue={record?.source ?? "个人估计"} required /></label>
      <label className="field full"><span>备注</span><textarea name="notes" defaultValue={record?.notes ?? ""} /></label>
      <button className={record ? "btn btn-secondary" : "btn btn-primary"} type="submit">{submitLabel}</button>
    </form>
  );
}
