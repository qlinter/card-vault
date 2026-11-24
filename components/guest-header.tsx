"use client";

import Link from "next/link";
import { useState } from "react";
import { accountErrorMessage, changeGuestSession } from "@/lib/account-client";
import { useLanguage } from "./language-provider";
import { LanguageSwitch } from "./language-switch";

export function GuestHeader() {
  const { locale } = useLanguage(), english = locale === "en";
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return <header className="topbar">
    <div className="container topbar-inner guest-topbar">
      <div className="guest-identity">
        <Link href="/showcase" className="brand">Card Vault</Link>
        <span className="guest-mode-label">{english ? "Guest browsing" : "访客浏览"}</span>
      </div>
      <div className="header-utilities">
        <button type="button" className="btn btn-secondary btn-quiet" disabled={busy} onClick={async () => {
          setBusy(true); setError("");
          try { await changeGuestSession("end-guest", "guest"); }
          catch (problem) { setError(accountErrorMessage(problem, english)); setBusy(false); }
        }}>{english ? "Exit guest mode" : "退出访客"}</button>
        <LanguageSwitch />
      </div>
    </div>
    {error ? <p role="alert" className="container account-error guest-header-error">{error}</p> : null}
  </header>;
}
