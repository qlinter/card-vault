"use client";

import { useState } from "react";
import { transactionKinds, isGift, type TransactionKind } from "@/lib/financial-history";
import { formatHistoryDateInput, transactionLabels } from "@/lib/financial-history-presentation";
import { UiText } from "./ui-text";
import { ExpenseKindSelect, HistoryCurrencySelect, ValuationSourceSelect } from "./financial-history-selects";
import { expenseContextInputLabels } from "@/lib/financial-history-presentation";
import type { EntryFinanceRecord, EntryFinanceValues } from "@/lib/card-entry-finance";

export function FinancialRecordFields({ type, values, prefix, compactCurrency = true, transactionKind, unknownAmount }: {
  type: EntryFinanceRecord["type"]; values: EntryFinanceValues; prefix: string;
  compactCurrency?: boolean;
  transactionKind?: TransactionKind;
  unknownAmount?: boolean;
}) {
  const [selected,setSelected] = useState(values.kind || "purchase");
  const kind = transactionKind ?? selected;
  const gift = type === "transaction" && isGift(kind);
  const name = (field: string) => prefix + field;
  const field = (key: keyof EntryFinanceValues, label: string, inputType = "text", required = false) => <label className="field"><span><UiText text={label} /></span><input name={name(key)} type={inputType} inputMode={key === "amount" ? "decimal" : undefined} max={type === "transaction" && key === "occurredAt" ? formatHistoryDateInput() : undefined} min={inputType === "number" ? 1 : undefined} step={inputType === "number" ? 1 : undefined} defaultValue={values[key] ?? (key === "quantity" ? "1" : "")} required={required} /></label>;
  return <>
    {type === "transaction" ? transactionKind ? <input type="hidden" name={name("kind")} value={transactionKind} /> : <label className="field"><span><UiText text="类型" /></span><select name={name("kind")} value={selected} onChange={e=>setSelected(e.target.value)}>{transactionKinds.map(value=><option key={value} value={value}><UiText text={transactionLabels[value]} /></option>)}</select></label> : null}
    {type === "expense" ? <>
      <label className="field full"><span><UiText text="费用归属" /></span><select name={name("context")} defaultValue={values.context || "grading"}>{Object.entries(expenseContextInputLabels).map(([value, label]) => <option key={value} value={value}><UiText text={label} /></option>)}</select></label>
      <label className="field"><span><UiText text="费用类型" /></span><ExpenseKindSelect name={name("kind")} defaultValue={values.kind || "grading"} /></label>
    </> : null}
    {!gift && <>{field("amount", type === "valuation" ? "单张估值" : unknownAmount && kind === values.kind ? "金额（待补）" : "金额", "text", !unknownAmount || kind !== values.kind)}
    <label className="field"><span><UiText text="币种" /></span><HistoryCurrencySelect name={name("currency")} defaultValue={values.currency || "CNY"} compact={compactCurrency} /></label></>}
    {type === "transaction" ? field("quantity", "数量", "number", true) : null}
    {field(type === "valuation" ? "valuedAt" : "occurredAt", type === "valuation" ? "估值日期" : "日期", "date", true)}
    {type === "transaction" ? field("source", kind === "gift_in" ? "赠予人" : kind === "gift_out" ? "受赠人" : "渠道 / 来源") : null}
    {type === "expense" ? field("vendor", "服务方") : null}
    {type === "valuation" ? <label className="field"><span><UiText text="估值来源 *" /></span><ValuationSourceSelect name={name("source")} defaultValue={values.source || "个人估计"} required /></label> : null}
    <label className="field full"><span><UiText text="备注" /></span><textarea name={name("notes")} defaultValue={values.notes || ""} /></label>
  </>;
}
