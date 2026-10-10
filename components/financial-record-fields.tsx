"use client";

import { useState, type ReactNode } from "react";
import { UiText } from "./ui-text";
import { ExpenseKindSelect, HistoryCurrencySelect, ValuationSourceSelect } from "./financial-history-selects";
import { expenseContextDescriptions, expenseContextInputLabels } from "@/lib/financial-history-presentation";
import type { EntryFinanceRecord, EntryFinanceValues } from "@/lib/card-entry-finance";

type FinancialSaleOption = { id: string; label: ReactNode };
export function FinancialRecordFields({ type, values, prefix, sales, showExpenseHelp = false }: {
  type: EntryFinanceRecord["type"]; values: EntryFinanceValues; prefix: string; sales: FinancialSaleOption[];
  showExpenseHelp?: boolean;
}) {
  const [context, setContext] = useState(values.context || "grading");
  const name = (field: string) => prefix + field;
  const field = (key: keyof EntryFinanceValues, label: string, inputType = "text", required = false) => <label className="field"><span><UiText text={label} /></span><input name={name(key)} type={inputType} inputMode={key === "amount" ? "decimal" : undefined} min={inputType === "number" ? 1 : undefined} step={inputType === "number" ? 1 : undefined} defaultValue={values[key] ?? (key === "quantity" ? "1" : "")} required={required} /></label>;
  return <>
    {type === "transaction" ? <label className="field"><span><UiText text="类型" /></span><select name={name("kind")} defaultValue={values.kind || "purchase"}><option value="purchase"><UiText text="购入" /></option><option value="sale"><UiText text="售出" /></option></select></label> : null}
    {type === "expense" ? <>
      <label className="field full"><span><UiText text="费用归属" /></span><select name={name("context")} value={context} onChange={event => setContext(event.target.value)}>{Object.entries(expenseContextInputLabels).map(([value, label]) => <option key={value} value={value}><UiText text={label} /></option>)}</select>{showExpenseHelp ? <small className="field-help"><UiText text={expenseContextDescriptions[context]} /></small> : null}</label>
      <label className="field"><span><UiText text="费用类型" /></span><ExpenseKindSelect name={name("kind")} defaultValue={values.kind || "grading"} /></label>
    </> : null}
    {field("amount", type === "valuation" ? "单张估值" : "金额", "text", true)}
    <label className="field"><span><UiText text="币种" /></span><HistoryCurrencySelect name={name("currency")} defaultValue={values.currency || "CNY"} compact={!showExpenseHelp || type === "transaction"} /></label>
    {type === "transaction" ? field("quantity", "数量", "number", true) : null}
    {field(type === "valuation" ? "valuedAt" : "occurredAt", type === "valuation" ? "估值日期" : "日期", "date", true)}
    {type === "transaction" ? field("source", "渠道 / 来源") : null}
    {type === "expense" ? field("vendor", "服务方") : null}
    {type === "expense" && context === "sale" ? <label className="field full"><span><UiText text="关联出售记录" /></span><select name={name("transactionId")} defaultValue={values.transactionId || ""} required><option value=""><UiText text="请选择" /></option>{sales.map(sale => <option key={sale.id} value={sale.id}>{sale.label}</option>)}</select>{!sales.length ? <small className="field-help"><UiText text="请先新增一笔出售交易。" /></small> : null}</label> : null}
    {type === "valuation" ? <label className="field"><span><UiText text="估值来源 *" /></span><ValuationSourceSelect name={name("source")} defaultValue={values.source || "个人估计"} required /></label> : null}
    <label className="field full"><span><UiText text="备注" /></span><textarea name={name("notes")} defaultValue={values.notes || ""} /></label>
  </>;
}
