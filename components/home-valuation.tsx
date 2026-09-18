"use client";

import { useEffect, useState, type ReactNode } from "react";
import { UiElement, UiText } from "./ui-text";
const preferenceKey = "card-vault:valuation-hidden";
export function HomeValuation({ amounts, children }: { amounts: string[]; children: ReactNode }) {
  // Keep the amount masked until the saved preference is read, avoiding a visible flash.
  const [visible, setVisible] = useState(false);
  useEffect(() => { try { setVisible(window.localStorage.getItem(preferenceKey) !== "true"); } catch { setVisible(true); } }, []);
  function toggle() {
    const next = !visible;
    setVisible(next);
    try { window.localStorage.setItem(preferenceKey, String(!next)); } catch { /* The toggle still works for this session. */ }
  }
  return <>
    <div className="valuation-summary-head">
      <div className="valuation-summary-label"><strong><UiText text="估值" /></strong><UiElement as="button" type="button" className="valuation-visibility-toggle" uiAttributes={["aria-label", "title"]} aria-label={visible ? "隐藏估值" : "显示估值"} title={visible ? "隐藏估值" : "显示估值"} aria-pressed={!visible} onClick={toggle}>
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" />{!visible ? <path d="m3 3 18 18" /> : null}</svg>
      </UiElement></div>
      <div className="valuation-summary-actions">{children}</div>
    </div>
    <div className="valuation-total-list" aria-live="polite">{visible ? (amounts.length ? amounts : ["—"]).map((amount,index) => <p className="h1 valuation-total-item" key={index}>{amount}</p>) : <p className="h1 valuation-total-item">••••••</p>}</div>
  </>;
}
