"use client";

import { useState } from "react";
import { UiText } from "./ui-text";
import { useLanguage } from "./language-provider";
import { ExpenseKindSelect, ValuationSourceSelect } from "./financial-history-selects";
import { expenseContextInputLabels } from "@/lib/financial-history-presentation";
import type { EntryFinanceRecord, EntryFinanceValues } from "@/lib/card-entry-finance";

type FinancialSaleOption = { id: string; label: string };
export function FinancialRecordFields({ type, values, prefix, sales }: {
  type: EntryFinanceRecord["type"]; values: EntryFinanceValues; prefix: string; sales: FinancialSaleOption[];
}) {
  const { locale } = useLanguage();
  const text = (zh: string, en: string) => locale === "en" ? en : zh;
  const [currency, setCurrency] = useState(values.currency || "CNY");
  const [context, setContext] = useState(values.context || "grading");
  const name = (field: string) => prefix + field;
  const field = (key: keyof EntryFinanceValues, label: string, inputType = "text", required = false) => <label className="field"><span><UiText text={label} /></span><input name={name(key)} type={inputType} inputMode={key === "amount" ? "decimal" : undefined} min={inputType === "number" ? 1 : undefined} step={inputType === "number" ? 1 : undefined} defaultValue={values[key] ?? (key === "quantity" ? "1" : "")} required={required} /></label>;
  return <>
    {type === "transaction" ? <label className="field"><span><UiText text="类型" /></span><select name={name("kind")} defaultValue={values.kind || "purchase"}><option value="purchase"><UiText text="购入" /></option><option value="sale"><UiText text="售出" /></option></select></label> : null}
    {type === "expense" ? <>
      <label className="field full"><span><UiText text="费用归属" /></span><select name={name("context")} value={context} onChange={event => setContext(event.target.value)}>{Object.entries(expenseContextInputLabels).map(([value, label]) => <option key={value} value={value}><UiText text={label} /></option>)}</select></label>
      <label className="field"><span><UiText text="费用类型" /></span><ExpenseKindSelect name={name("kind")} defaultValue={values.kind || "grading"} /></label>
    </> : null}
    {field("amount", type === "valuation" ? "单张估值" : "金额", "text", true)}
    <label className="field"><span><UiText text="币种" /></span><select name={name("currency")} value={currency} onChange={event => setCurrency(event.target.value)}><option value="CNY">CNY</option><option value="USD">USD</option></select></label>
    {type === "transaction" ? <>
      <label className="field" data-i18n-skip><span>{text("另一币种付款 / 收款（可选）", "Additional payment / receipt (optional)")} · {currency === "CNY" ? "USD" : "CNY"}</span><input name={name("secondaryAmount")} inputMode="decimal" defaultValue={values.secondaryAmount || ""} /></label>
      <label className="field full" data-i18n-skip><span><input type="checkbox" name={name("amountUnknown")} defaultChecked={values.amountUnknown === "on"} /> {text("金额尚不完整（已知零成本请勿勾选）", "Amount incomplete (leave unchecked for a known zero cost)")}</span></label>
      {field("quantity", "数量", "number", true)}
    </> : null}
    {field(type === "valuation" ? "valuedAt" : "occurredAt", type === "valuation" ? "估值日期" : "日期", "date", true)}
    {type === "transaction" ? field("source", "渠道 / 来源") : null}
    {type === "expense" ? field("vendor", "服务方") : null}
    {type === "expense" && context === "sale" ? <label className="field full"><span><UiText text="关联出售记录" /></span><select name={name("transactionId")} defaultValue={values.transactionId || ""} required><option value=""><UiText text="请选择" /></option>{sales.map(sale => <option key={sale.id} value={sale.id}>{sale.label}</option>)}</select>{!sales.length ? <small className="field-help"><UiText text="请先新增一笔出售交易。" /></small> : null}</label> : null}
    {type === "valuation" ? <label className="field"><span><UiText text="估值来源 *" /></span><ValuationSourceSelect name={name("source")} defaultValue={values.source || "个人估计"} required /></label> : null}
    <label className="field full"><span><UiText text="备注" /></span><textarea name={name("notes")} defaultValue={values.notes || ""} /></label>
  </>;
}
