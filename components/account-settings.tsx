"use client";

import { useState, type FormEvent } from "react";
import { accountErrorMessage, accountRequest, AccountRequestError, returnToSignIn } from "@/lib/account-client";
import { useLanguage } from "./language-provider";
import { SettingsDisclosure } from "./settings-disclosure";
import { PasswordField } from "./account-fields";
import { useAccountRecovery } from "./account-boundary";

export function AccountSettings({ username }: { username: string }) {
  const { locale } = useLanguage(), english = locale === "en";
  const [mode, setMode] = useState("change-username"), [name, setName] = useState(username);
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(""), [error, setError] = useState("");
  const showRecovery = useAccountRecovery();
  const showError = (problem: unknown) => setError(accountErrorMessage(problem, english));
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return;
    const form = event.currentTarget, values = Object.fromEntries(new FormData(form));
    setBusy(true); setError(""); setMessage("");
    try {
      if (mode === "change-password" && values.password !== values.confirmPassword) throw new AccountRequestError("mismatch");
      const result = await accountRequest(mode, values);
      form.reset();
      if (result.logout) { returnToSignIn(true); }
      else if (result.recoveryCode) { showRecovery(result.recoveryCode); }
      else { setName(result.username || name); setMessage(english ? "Username updated." : "用户名已更新。"); }
    } catch (problem) { showError(problem); }
    finally { setBusy(false); }
  }
  return <SettingsDisclosure id="account-security" zh="账户与安全" en="Account & security" openOnHash={false}>
    <div className="account-settings">
      <p className="account-current"><span>{english ? "Username" : "用户名"}</span><strong>{name}</strong></p>
      <form className="account-form" onSubmit={submit}>
        <fieldset disabled={busy}>
          <label className="account-field" htmlFor="account-change"><span>{english ? "Manage account" : "账户管理"}</span>
            <select id="account-change" value={mode} onChange={event => { setMode(event.target.value); setError(""); setMessage(""); }}>
              <option value="change-username">{english ? "Change username" : "修改用户名"}</option>
              <option value="change-password">{english ? "Change password" : "修改密码"}</option>
              <option value="rotate-recovery">{english ? "Replace recovery code" : "更换恢复码"}</option>
            </select>
          </label>
          <input type="hidden" autoComplete="username" name="currentUsername" value={name} />
          <PasswordField id="account-current-password" name="currentPassword" label={english ? "Current password" : "当前密码"} />
          {mode === "change-username" ? <label className="account-field" htmlFor="account-new-username"><span>{english ? "New username" : "新用户名"}</span><input id="account-new-username" name="username" required minLength={3} maxLength={64} autoComplete="username" /></label> : null}
          {mode === "change-password" ? <>
            <PasswordField id="account-new-password" label={english ? "New password" : "新密码"} newPassword />
            <PasswordField id="account-confirm-password" name="confirmPassword" label={english ? "Confirm password" : "确认密码"} newPassword />
          </> : null}
          <button type="submit" className="btn btn-secondary btn-quiet">{english ? (busy ? "Saving…" : "Confirm") : (busy ? "正在保存…" : "确认修改")}</button>
        </fieldset>
      </form>
      {error ? <p className="account-error" role="alert">{error}</p> : null}
      {message ? <p role="status" className="account-hint">{message}</p> : null}
    </div>
  </SettingsDisclosure>;
}
