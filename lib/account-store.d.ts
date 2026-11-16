export const ACCOUNT_COOKIE: string;
export type AccountStatus = { state: "setup" | "ready" | "unavailable"; authenticated: boolean; username?: string; recoveryPending?: boolean };
export type AccountResult = { token?: string; recoveryCode?: string; username?: string; logout?: boolean };
export class AccountError extends Error { constructor(code: string, status?: number, retryAfter?: number); code: string; status: number; retryAfter: number; }
export function defaultAccountPath(): string;
export function createAccountStore(options?: { filePath?: string; runId?: string; now?: () => number }): {
  filePath: string;
  status(token?: string): AccountStatus;
  execute(action: string, input?: Record<string, unknown>, token?: string): Promise<AccountResult>;
  lock(): Promise<void>;
};
