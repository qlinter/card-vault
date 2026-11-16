"use client";

import { useState } from "react";
import { signOutAccount, SIGN_OUT_FAILURE_EVENT } from "@/lib/account-client";
import { useLanguage } from "./language-provider";

export function SettingsSignOut() {
  const { locale } = useLanguage(), english = locale === "en";
  const [busy, setBusy] = useState(false);
  async function signOut() {
    if (busy) return;
    setBusy(true);
    try { await signOutAccount(); }
    catch (problem) { setBusy(false); window.dispatchEvent(new CustomEvent(SIGN_OUT_FAILURE_EVENT, { detail: problem })); }
  }
  return <button type="button" className="btn btn-secondary settings-sign-out" disabled={busy} onClick={() => void signOut()}>
    {english ? (busy ? "Signing out…" : "Sign out") : (busy ? "正在退出…" : "退出登录")}
  </button>;
}
