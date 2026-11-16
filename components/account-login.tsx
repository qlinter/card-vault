"use client";

import { useState, type FormEvent } from "react";
import type { AccountStatus } from "@/lib/account-store";
import { accountErrorMessage, accountRequest, AccountRequestError } from "@/lib/account-client";
import { useLanguage } from "./language-provider";
import { LanguageSwitch } from "./language-switch";
import { PasswordField, RecoveryConfirmation } from "./account-fields";

export function AccountLogin({ status }: { status: AccountStatus }) {
  const { locale } = useLanguage(), english = locale === "en";
  const [recover, setRecover] = useState(false), [code, setCode] = useState("");
  const [recoveredUsername, setRecoveredUsername] = useState("");
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const setup = status.state === "setup";
  const showError = (problem: unknown) => setError(accountErrorMessage(problem, english));
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setError(""); setBusy(true);
    const values = Object.fromEntries(new FormData(event.currentTarget));
    try {
      if ((setup || recover) && values.password !== values.confirmPassword) throw new AccountRequestError("mismatch");
      const result = await accountRequest(setup ? "setup" : recover ? "recover" : "login", values);
      if (result.recoveryCode) { setCode(result.recoveryCode); setRecoveredUsername(result.username || ""); }
      else window.location.replace("/");
    } catch (problem) { showError(problem); }
    finally { setBusy(false); }
  }
  return <div className="account-gateway">
    <div className="account-gateway-tools"><LanguageSwitch /></div>
    <section className="account-card panel" aria-labelledby="account-heading">
      <div className="account-brand">Card Vault</div>
      <h1 id="account-heading">{english ? (code ? "Recovery code" : setup ? "Create your account" : recover ? "Reset password" : "Sign in") : (code ? "恢复码" : setup ? "创建本地账户" : recover ? "重设密码" : "登录")}</h1>
      {status.state === "unavailable" ? <>
        <p role="alert" className="account-error">{accountErrorMessage(new AccountRequestError("account-unavailable"), english)}</p>
        <button className="btn btn-secondary btn-quiet" type="button" onClick={() => window.location.reload()}>{english ? "Retry" : "重试"}</button>
      </> : code ? <RecoveryConfirmation code={code} username={recoveredUsername} onError={showError} /> : <>
        <form key={recover ? "recover" : "login"} className="account-form" onSubmit={submit} aria-describedby={error ? "account-error" : undefined}>
          <fieldset disabled={busy}>
            {recover ? <label className="account-field" htmlFor="recovery-code"><span>{english ? "Recovery code" : "恢复码"}</span><input id="recovery-code" name="recoveryCode" autoComplete="off" spellCheck={false} required maxLength={128} /></label>
              : <label className="account-field" htmlFor="account-username"><span>{english ? "Username" : "用户名"}</span><input id="account-username" name="username" autoComplete="username" required minLength={3} maxLength={64} spellCheck={false} /></label>}
            <PasswordField key={recover ? "new" : "login"} id="account-password" label={english ? (recover ? "New password" : "Password") : (recover ? "新密码" : "密码")} newPassword={setup || recover} />
            {setup || recover ? <PasswordField id="confirm-password" name="confirmPassword" label={english ? "Confirm password" : "确认密码"} newPassword /> : null}
            <button className="btn btn-secondary btn-quiet btn-soft account-submit" disabled={busy} type="submit">{english ? (busy ? "Please wait…" : setup ? "Create account" : recover ? "Reset password" : "Sign in") : (busy ? "正在处理…" : setup ? "创建账户" : recover ? "重设密码" : "登录")}</button>
          </fieldset>
        </form>
        {!setup ? <button className="account-text-button" type="button" disabled={busy} onClick={() => { setRecover(!recover); setError(""); }}>{english ? (recover ? "Back to sign in" : "Forgot password?") : (recover ? "返回登录" : "忘记密码")}</button> : null}
      </>}
      {error ? <p id="account-error" className="account-error" role="alert">{error}</p> : null}
    </section>
  </div>;
}
