"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { accountErrorMessage, signOutAccount, maskAccount, readAccountStatus, returnToSignIn, subscribeAccountEnd, SIGN_OUT_FAILURE_EVENT } from "@/lib/account-client";
import { useLanguage } from "./language-provider";
import { RecoveryConfirmation } from "./account-fields";

const AccountRecoveryContext = createContext<((code: string) => void) | null>(null);

export function useAccountRecovery() {
  const showRecovery = useContext(AccountRecoveryContext);
  if (!showRecovery) throw new Error("Account recovery requires the account boundary.");
  return showRecovery;
}

export function AccountBoundary({ children }: { children: React.ReactNode }) {
  const { locale } = useLanguage(), english = locale === "en";
  const [error, setError] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const recoveryActive = useRef(false);
  const showRecovery = (code: string) => { recoveryActive.current = true; setError(""); setRecoveryCode(code); };
  useEffect(() => {
    const originalFetch = window.fetch;
    let disposed = false;
    const leave = () => returnToSignIn();
    window.fetch = async (...args) => {
      const response = await originalFetch(...args);
      const target = args[0] instanceof Request ? args[0].url : String(args[0]);
      const url = new URL(target, window.location.href);
      if (response.status === 401 && url.origin === window.location.origin && url.pathname !== "/api/account") void check(true);
      return response;
    };
    const unsubscribeMessages = subscribeAccountEnd(leave);
    const check = async (mask = false) => {
      if (mask) maskAccount();
      try {
        const status = await readAccountStatus(originalFetch);
        if (disposed) return;
        if (!status.authenticated && !(recoveryActive.current && status.recoveryPending)) { leave(); return; }
        if (!disposed && document.documentElement.dataset.accountEnding !== "true") { delete document.documentElement.dataset.accountMasked; setError(""); }
      } catch {
        // A backup can temporarily stop the service. Keep an already masked page
        // covered until the next successful check; never treat failure as login.
        if (mask && !disposed) setError(english ? "The local service is reconnecting…" : "正在重新连接本地服务…");
      }
    };
    const onShow = (event: PageTransitionEvent) => { if (event.persisted) void check(true); };
    // Dialogs and file pickers can focus the window without backgrounding the
    // document. Verify the session without hiding the control restoring focus.
    const onFocus = () => void check();
    const onVisibility = () => { if (document.visibilityState === "visible") void check(true); };
    const onSignOutFailure = (event: Event) => { if (event instanceof CustomEvent) setError(accountErrorMessage(event.detail, english)); };
    const interval = window.setInterval(() => { if (document.visibilityState === "visible") void check(); }, 15_000);
    const unsubscribe = window.cardVaultDesktop?.onAccountLocked?.(leave);
    window.addEventListener("pagehide", maskAccount);
    window.addEventListener("pageshow", onShow);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener(SIGN_OUT_FAILURE_EVENT, onSignOutFailure);
    return () => {
      disposed = true; window.fetch = originalFetch; unsubscribeMessages(); window.clearInterval(interval); unsubscribe?.();
      window.removeEventListener("pagehide", maskAccount); window.removeEventListener("pageshow", onShow);
      window.removeEventListener("focus", onFocus); document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener(SIGN_OUT_FAILURE_EVENT, onSignOutFailure);
    };
  }, [english]);
  return <AccountRecoveryContext.Provider value={showRecovery}>
    <div className="account-private-content">{recoveryCode ? <div className="account-gateway">
      <section className="account-card panel" aria-labelledby="recovery-heading">
        <div className="account-brand">Card Vault</div>
        <h1 id="recovery-heading">{english ? "Recovery code" : "恢复码"}</h1>
        <RecoveryConfirmation code={recoveryCode} onError={problem => setError(accountErrorMessage(problem, english))} />
        {error ? <p className="account-error" role="alert">{error}</p> : null}
      </section>
    </div> : children}</div>
    <div className="account-lock-cover" role="status">
      <strong>Card Vault</strong>
      <p>{error || (english ? "Please sign in again" : "请重新登录")}</p>
      <button type="button" className="btn btn-secondary btn-quiet" onClick={async () => {
        try { await signOutAccount(); } catch (problem) { setError(accountErrorMessage(problem, english)); }
      }}>{english ? "Return to sign in" : "返回登录"}</button>
    </div>
  </AccountRecoveryContext.Provider>;
}
