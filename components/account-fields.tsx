"use client";

import { useState } from "react";
import { useLanguage } from "./language-provider";
import { accountErrorMessage, accountRequest, AccountRequestError, returnToSignIn } from "@/lib/account-client";
import passwordPolicy from "@/lib/account-password-policy.json";

export function PasswordField({ id, label, name = "password", newPassword = false }: {
  id: string; label: string; name?: string; newPassword?: boolean;
}) {
  const { locale } = useLanguage();
  const [visible, setVisible] = useState(false);
  const english = locale === "en";
  const toggleLabel = english ? (visible ? "Hide password" : "Show password") : (visible ? "隐藏密码" : "显示密码");
  return <div className="account-field">
    <label htmlFor={id}>{label}</label>
    <span className="account-password">
      <input id={id} name={name} type={visible ? "text" : "password"} autoComplete={newPassword ? "new-password" : "current-password"} required
        pattern={newPassword ? `[\\s\\S]{${passwordPolicy.minLength},${passwordPolicy.maxLength}}` : undefined}
        maxLength={newPassword ? undefined : passwordPolicy.maxLength * 2} spellCheck={false}
        onInvalid={event => { if (newPassword) event.currentTarget.setCustomValidity(accountErrorMessage(new AccountRequestError("invalid-password"), english)); }}
        onInput={event => event.currentTarget.setCustomValidity("")} />
      <button type="button" className="account-reveal" aria-label={toggleLabel} title={toggleLabel} aria-pressed={visible} onClick={() => setVisible(!visible)}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
          <circle cx="12" cy="12" r="3" />
          {visible ? <path d="m3 3 18 18" /> : null}
        </svg>
      </button>
    </span>
  </div>;
}

export function RecoveryConfirmation({ code, username, onError }: { code: string; username?: string; onError: (error: unknown) => void }) {
  const { locale } = useLanguage(), english = locale === "en";
  const [acknowledged, setAcknowledged] = useState(false), [busy, setBusy] = useState(false);
  return <div className="account-recovery">
    <h2>{english ? "Save your recovery code" : "保存恢复码"}</h2>
    {username ? <p className="account-current"><span>{english ? "Username" : "用户名"}</span><strong>{username}</strong></p> : null}
    <p className="account-hint">{english ? "Keep it somewhere safe, outside this device. It can reset your password and is shown only now." : "请保存在本机之外的安全位置。恢复码可重设密码，仅在此时显示。"}</p>
    <code className="account-recovery-code">{code}</code>
    <label className="account-check"><input type="checkbox" checked={acknowledged} onChange={event => setAcknowledged(event.target.checked)} />{english ? "I have saved the recovery code" : "我已妥善保存恢复码"}</label>
    <button type="button" className="btn btn-secondary btn-quiet btn-soft account-submit" disabled={!acknowledged || busy} onClick={async () => {
      setBusy(true);
      try {
        const result = await accountRequest("confirm-recovery", { acknowledged: true });
        if (result.logout) returnToSignIn(true);
        else window.location.replace("/");
      } catch (error) { onError(error); setBusy(false); }
    }}>{english ? (busy ? "Confirming…" : "Continue") : (busy ? "正在确认…" : "继续")}</button>
  </div>;
}
