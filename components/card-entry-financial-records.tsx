"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { UiText } from "./ui-text";
import { useLanguage } from "./language-provider";
import { FinancialRecordFields } from "./financial-record-fields";
import { parseEntryFinance, maxEntryFinanceRecords, type EntryFinanceRecord, type EntryFinanceValues } from "@/lib/card-entry-finance";

export function CardEntryFinancialRecords({ initialValue = "[]" }: { initialValue?: string }) {
  const { locale } = useLanguage();
  const [records, setRecords] = useState<EntryFinanceRecord[]>(() => { try { return parseEntryFinance(initialValue); } catch { return []; } });
  const [adding, setAdding] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const signature = records.map(row => row.id).join(",");
  const previousSignature = useRef(signature);
  useEffect(() => {
    if (previousSignature.current !== signature) panel.current?.dispatchEvent(new Event("change", { bubbles:true }));
    previousSignature.current = signature;
  }, [signature]);
  const labels = {transaction:"交易",expense:"费用",valuation:"估值"};
  const sales = records.filter(row => row.type === "transaction" && row.values.kind === "sale").map((row,index) => ({id:row.id,label:`${locale === "en" ? "Sale" : "售出"} ${index+1} · ${row.values.occurredAt || "—"} · ${row.values.amount || "—"} ${row.values.currency || "CNY"}`}));
  function add(type: EntryFinanceRecord["type"]) {
    setRecords(current => [...current, {id:crypto.randomUUID(),type,values:{}}]);
    setAdding(false);
  }
  function changed(event: ChangeEvent<HTMLFieldSetElement>, id: string) {
    const input = event.target;
    if (!(input instanceof HTMLInputElement || input instanceof HTMLSelectElement || input instanceof HTMLTextAreaElement)) return;
    const key = input.name.slice(`finance.${id}.`.length) as keyof EntryFinanceValues;
    const value = input instanceof HTMLInputElement && input.type === "checkbox" ? (input.checked ? "on" : "") : input.value;
    setRecords(current => current.map(row => row.id === id ? {...row,values:{...row.values,[key]:value}} : row));
  }
  return <div className="entry-financial-records" ref={panel}>
    <div className="entry-financial-record-toolbar">
      <button type="button" className="btn btn-secondary" aria-expanded={adding} disabled={records.length >= maxEntryFinanceRecords} onClick={() => setAdding(value => !value)}><UiText text="＋ 新增记录" /></button>
      {adding ? <div className="entry-financial-record-types">{(["transaction","expense","valuation"] as const).map(type => <button type="button" className="btn btn-secondary" key={type} onClick={() => add(type)}><UiText text={labels[type]} /></button>)}</div> : null}
    </div>
    {records.map((record,index) => <fieldset className="entry-financial-record" key={record.id} onChange={event => changed(event,record.id)}>
      <legend><UiText text={labels[record.type]} /> {index+1}</legend>
      <input type="hidden" name="financialRecordId" value={record.id} />
      <input type="hidden" name={`finance.${record.id}.type`} value={record.type} />
      <div className="form-grid"><FinancialRecordFields type={record.type} values={record.values} prefix={`finance.${record.id}.`} sales={sales} /></div>
      <button type="button" className="btn btn-secondary entry-financial-remove" onClick={() => setRecords(current => current.filter(row => row.id !== record.id))}><UiText text="删除" /></button>
    </fieldset>)}
  </div>;
}
