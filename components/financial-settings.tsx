"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { savePrimaryCurrency, saveExchangeRate, deleteExchangeRate } from "@/app/actions/financial-settings";
import { useLanguage } from "./language-provider";
import { DisclosureIcon } from "./disclosure-icon";
import { type FinancialConfig, type FxRate } from "@/lib/financial-reporting";

function Feedback({ state, pending }: { state: { error?: string; saved?: boolean }; pending: boolean }) {
  const { locale } = useLanguage();
  return !pending && state.error ? <p className="note-error" role="alert">{state.error}</p> : !pending && state.saved ? <p className="note-ok" role="status">{locale === "en" ? "Saved." : "已保存。"}</p> : null;
}

function RateForm({ rate, onCancel }: { rate?: FxRate; onCancel?: () => void }) {
  const { locale } = useLanguage();
  const text = (zh: string, en: string) => locale === "en" ? en : zh;
  const [state, action, pending] = useActionState(saveExchangeRate, {});
  const [rateInput, setRateInput] = useState(rate ? String(Number(rate.rateMicros) / 1000000) : "");
  const [dayInput, setDayInput] = useState(rate?.effectiveDate ?? "");
  const [sourceInput, setSourceInput] = useState(rate?.source ?? "");
  return <form action={action} className="exchange-rate-form">
    {rate ? <input type="hidden" name="id" value={rate.id} /> : null}
    <label className="field"><span>{text("汇率（1 USD = CNY）", "Rate (1 USD = CNY)")}</span><input name="rate" inputMode="decimal" required value={rateInput} onChange={(event) => setRateInput(event.target.value)} placeholder="7.000000" /></label>
    <label className="field"><span>{text("生效日期", "Effective date")}</span><input name="effectiveDate" type="date" required value={dayInput} onChange={(event) => setDayInput(event.target.value)} /></label>
    <label className="field"><span>{text("来源 / 修正说明（可选）", "Source / correction note (optional)")}</span><input name="source" maxLength={200} value={sourceInput} onChange={(event) => setSourceInput(event.target.value)} /></label>
    <div className="financial-form-actions"><button className="btn btn-primary" disabled={pending}>{text(pending ? "正在保存…" : rate ? "保存修改" : "保存汇率", pending ? "Saving…" : rate ? "Save changes" : "Save rate")}</button>{onCancel ? <button type="button" className="btn" onClick={onCancel} disabled={pending}>{text("关闭编辑", "Close editor")}</button> : null}</div>
    <Feedback state={state} pending={pending} />
  </form>;
}

function RateRow({ rate }: { rate: FxRate }) {
  const { locale } = useLanguage();
  const text = (zh: string, en: string) => locale === "en" ? en : zh;
  const [editing, setEditing] = useState(false);
  const [state, action, pending] = useActionState(deleteExchangeRate, {});
  return <li className="exchange-rate-row">
    <div className="exchange-rate-summary"><div><strong>{rate.effectiveDate}</strong><p>1 USD = {Number(rate.rateMicros) / 1000000} CNY</p>{rate.source ? <small className="muted">{rate.source}</small> : null}</div>
      <div className="financial-form-actions"><button className="btn" type="button" onClick={() => setEditing(!editing)} disabled={pending}>{text("编辑", "Edit")}</button><form action={action}><input type="hidden" name="id" value={rate.id} /><button className="btn" disabled={pending}>{text(pending ? "正在删除…" : "删除", pending ? "Deleting…" : "Delete")}</button></form></div>
    </div>
    {editing ? <RateForm rate={rate} onCancel={() => setEditing(false)} /> : null}
    <Feedback state={state} pending={pending} />
  </li>;
}

export function FinancialSettings({ config }: { config: FinancialConfig }) {
  const { locale } = useLanguage();
  const text = (zh: string, en: string) => locale === "en" ? en : zh;
  const [isOpen, setIsOpen] = useState(false);
  const [state, action, pending] = useActionState(savePrimaryCurrency, {});
  useEffect(() => { if (window.location.hash === "#financial-settings") setIsOpen(true); }, []);
  return <section className="panel settings-section" id="financial-settings" data-i18n-skip>
    <button type="button" className="ai-settings-toggle" onClick={() => setIsOpen(!isOpen)} aria-expanded={isOpen} aria-label={text(isOpen ? "收起财务" : "展开财务", isOpen ? "Collapse Finance" : "Expand Finance")}><span><strong>{text("财务", "Finance")}</strong></span><DisclosureIcon expanded={isOpen} /></button>
    {isOpen ? <div className="financial-settings-body">
      <p className="finance-rules-link"><Link href="/settings/finance-rules">{text("查看财务计算规则 →", "Financial calculation rules →")}</Link></p>
      <form action={action} className="primary-currency-form"><label className="field"><span>{text("主币种", "Primary currency")}</span><select name="reportingCurrency" defaultValue={config.reportingCurrency}><option value="CNY">CNY</option><option value="USD">USD</option></select></label><button className="btn btn-primary" disabled={pending}>{text(pending ? "正在保存…" : "保存主币种", pending ? "Saving…" : "Save primary currency")}</button><Feedback state={state} pending={pending} /></form>
      <h3>{text("新增汇率", "Add exchange rate")}</h3><RateForm />
      <details className="exchange-rate-history"><summary>{text("汇率历史", "Rate history")} ({config.rates.length})</summary><ul>{config.rates.map((rate) => <RateRow key={rate.id} rate={rate} />)}</ul>{config.rates.length === 0 ? <p className="muted">{text("暂无汇率记录", "No exchange rates yet")}</p> : null}</details>
    </div> : null}
  </section>;
}
