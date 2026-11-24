"use client";

import { useState, type FormEvent } from "react";
import { accountErrorMessage, accountRequest, AccountRequestError, changeGuestSession, returnToSignIn } from "@/lib/account-client";
import { useLanguage } from "./language-provider";
import { SettingsDisclosure } from "./settings-disclosure";
import { PasswordField } from "./account-fields";
import { useAccountRecovery } from "./account-boundary";

export function AccountSettings({ username, initialGuestEnabled, publicCardCount }: { username: string; initialGuestEnabled: boolean; publicCardCount: number }) {
  const { locale } = useLanguage(), english = locale === "en";
  const [mode, setMode] = useState("change-username"), [name, setName] = useState(username);
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(""), [error, setError] = useState("");
  const [guestEnabled, setGuestEnabled] = useState(initialGuestEnabled);
  const [guestError, setGuestError] = useState("");
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
      <div className="account-guest-settings">
        <label className="account-check"><input type="checkbox" checked={guestEnabled} disabled={busy} onChange={async event => {
          const enabled = event.currentTarget.checked;
          setGuestEnabled(enabled);
          setBusy(true); setGuestError("");
          try { const result = await accountRequest("set-guest", { enabled }); setGuestEnabled(result.guestEnabled === true); }
          catch (problem) { setGuestEnabled(!enabled); setGuestError(accountErrorMessage(problem, english)); }
          finally { setBusy(false); }
        }} />{english ? "Allow guest browsing" : "允许访客浏览"}</label>
        {guestEnabled ? <>
          <p className="account-hint">{english ? `${publicCardCount} public cards available to guests` : `访客可查看 ${publicCardCount} 张公开卡牌`}</p>
          <button type="button" className="btn btn-secondary" disabled={busy} onClick={async () => {
            setBusy(true); setGuestError("");
            try { await changeGuestSession("start-guest", "owner"); }
            catch (problem) { setGuestError(accountErrorMessage(problem, english)); setBusy(false); }
          }}>{english ? "Switch to guest browsing" : "进入访客浏览"}</button>
        </> : null}
        {guestError ? <p className="account-error" role="alert">{guestError}</p> : null}
      </div>
    </div>
  </SettingsDisclosure>;
}
