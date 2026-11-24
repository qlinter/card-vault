import passwordPolicy from "./account-password-policy.json";
import type { AccountStatus } from "./account-store";

export type AccountReply = { recoveryCode?: string; username?: string; logout?: boolean; guestEnabled?: boolean };
export const SIGN_OUT_FAILURE_EVENT = "card-vault:account-sign-out-failed";
export class AccountRequestError extends Error {
  constructor(public code: string, public retryAfter = 0) { super(code); }
}

export async function accountRequest(action: string, values: Record<string, unknown> = {}): Promise<AccountReply> {
  const response = await fetch("/api/account", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...values, action }), cache: "no-store"
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const code = payload.error === "incorrect-credentials"
      ? action === "login" ? "incorrect-login" : action === "recover" ? "incorrect-recovery-code" : "incorrect-password"
      : payload.error || "unavailable";
    throw new AccountRequestError(code, payload.retryAfter);
  }
  return payload;
}

export function accountErrorMessage(error: unknown, english: boolean): string {
  const code = error instanceof AccountRequestError ? error.code : "network";
  const messages: Record<string, [string, string]> = {
    "incorrect-login": ["用户名或密码不正确。", "The username or password is incorrect."],
    "incorrect-recovery-code": ["恢复码不正确。", "The recovery code is incorrect."],
    "incorrect-password": ["当前密码不正确。", "The current password is incorrect."],
    "invalid-username": ["用户名需为 3–64 个字符。", "Use 3–64 characters for the username."],
    "invalid-password": [`密码需为 ${passwordPolicy.minLength}–${passwordPolicy.maxLength} 个字符。`, `Use ${passwordPolicy.minLength}–${passwordPolicy.maxLength} characters for the password.`],
    "already-configured": ["账户已创建，请返回登录。", "An account already exists. Return to sign in."],
    "login-required": ["登录已失效，请重新登录。", "Your session has ended. Please sign in again."],
    "guest-disabled": ["访客浏览未开启。请登录后在账户与安全中开启。", "Sign in and enable guest browsing in Account & security."],
    "account-unavailable": ["无法读取账户配置。请检查本机账户文件或恢复其副本后重启应用。", "The account configuration cannot be read. Check or restore the local account files, then restart the app."],
    "account-busy": ["账户操作正在进行，请稍后重试。", "An account operation is in progress. Please try again shortly."],
    "network": ["连接中断，请稍后重试。", "The connection was interrupted. Please try again."],
    "sign-out-unavailable": ["退出登录未完成。请检查账户配置文件的读写权限后重启应用。", "Sign-out did not complete. Check account-file permissions and restart the app."],
    "service-reconnecting": ["本地服务暂未恢复，请等待当前存储操作完成后重试。", "The local service is reconnecting. Wait for the current storage operation to finish, then retry."],
    "mismatch": ["两次输入的密码不一致。", "The passwords do not match."],
    "invalid-origin": ["请求来源无法确认，请刷新页面后重试。", "The request origin could not be verified. Refresh the page and try again."]
  };
  if (code === "try-later") {
    const seconds = error instanceof AccountRequestError ? error.retryAfter : 60;
    return english ? `Too many attempts. Try again in ${seconds} seconds.` : `尝试次数过多，请 ${seconds} 秒后重试。`;
  }
  const message = messages[code] || ["操作未完成，请重试。", "The operation did not complete. Please try again."];
  return message[english ? 1 : 0];
}

export function maskAccount() { document.documentElement.dataset.accountMasked = "true"; }
export function broadcastAccountEnd() {
  try {
    const channel = new BroadcastChannel("card-vault-account");
    channel.postMessage("session-ended"); channel.close();
  } catch { /* Session checks still protect windows when browser messaging is unavailable. */ }
}

export function subscribeAccountEnd(onEnd: () => void): () => void {
  try {
    const channel = new BroadcastChannel("card-vault-account");
    channel.onmessage = event => { if (event.data === "session-ended") onEnd(); };
    return () => channel.close();
  } catch { return () => {}; }
}

export function returnToSignIn(broadcast = false) {
  document.documentElement.dataset.accountEnding = "true";
  maskAccount();
  if (broadcast) broadcastAccountEnd();
  window.location.replace("/login");
}

export async function readAccountStatus(fetcher: typeof fetch = window.fetch): Promise<AccountStatus> {
  const response = await fetcher("/api/account", { cache: "no-store", signal: AbortSignal.timeout(3000) });
  const status = await response.json();
  if (!["setup", "ready", "unavailable"].includes(status.state) || typeof status.authenticated !== "boolean") throw new AccountRequestError("unavailable");
  return status;
}

export async function changeGuestSession(action: "start-guest" | "end-guest", currentMode: "login" | "owner" | "guest") {
  document.documentElement.dataset.accountEnding = "true";
  if (currentMode !== "login") maskAccount();
  try {
    await accountRequest(action);
  } catch (problem) {
    delete document.documentElement.dataset.accountEnding;
    if (currentMode !== "login") {
      const status = await readAccountStatus().catch(() => null);
      if (currentMode === "owner" ? status?.authenticated : status?.guest) {
        delete document.documentElement.dataset.accountMasked;
      } else {
        returnToSignIn();
      }
    }
    throw problem;
  }
  broadcastAccountEnd();
  window.location.replace(action === "start-guest" ? "/showcase" : "/login");
}

export async function signOutAccount() {
  document.documentElement.dataset.accountEnding = "true";
  maskAccount();
  if (window.cardVaultDesktop?.signOutAccount) {
    try { await window.cardVaultDesktop.signOutAccount(); } catch { throw new AccountRequestError("sign-out-unavailable"); }
    // IPC can revoke access while backup/restore has paused Next. Keep the
    // renderer covered until the login page is reachable instead of navigating
    // to a connection-error page or interrupting the storage worker.
    const deadline = performance.now() + 60_000;
    let ready = false;
    while (performance.now() < deadline) {
      try {
        const status = await readAccountStatus();
        if (status.authenticated === false) { ready = true; break; }
      } catch { /* The storage operation still owns the paused service. */ }
      await new Promise(resolve => window.setTimeout(resolve, 500));
    }
    if (!ready) throw new AccountRequestError("service-reconnecting");
  }
  else await accountRequest("logout");
  returnToSignIn(true);
}
