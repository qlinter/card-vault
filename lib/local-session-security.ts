import { timingSafeEqual } from "node:crypto";

export const localSessionCookieName = "card-vault-session";
export const localSessionHeaderName = "x-card-vault-session";

type LocalSessionRequest = {
  expectedToken?: string | null;
  allowedOrigin?: string | null;
  requestHost?: string | null;
  method: string;
  origin?: string | null;
  cookieToken?: string | null;
  headerToken?: string | null;
};

export type LocalSessionDecision =
  | { allowed: true; mode: "disabled" | "cookie" | "header" }
  | { allowed: false; reason: "invalid-config" | "invalid-host" | "invalid-origin" | "missing-session" };

function secureTokenEqual(left: string | null | undefined, right: string): boolean {
  if (!left) return false;
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function normalizedOrigin(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function isReadOnlyMethod(method: string): boolean {
  return method === "GET" || method === "HEAD";
}

export function evaluateLocalSessionRequest(input: LocalSessionRequest): LocalSessionDecision {
  const expectedToken = input.expectedToken?.trim();
  if (!expectedToken) return { allowed: true, mode: "disabled" };

  const allowedOrigin = normalizedOrigin(input.allowedOrigin);
  if (!allowedOrigin) return { allowed: false, reason: "invalid-config" };
  const allowedHost = new URL(allowedOrigin).host;
  if (input.requestHost?.trim().toLowerCase() !== allowedHost.toLowerCase()) return { allowed: false, reason: "invalid-host" };

  const headerAuthenticated = secureTokenEqual(input.headerToken, expectedToken);
  const cookieAuthenticated = secureTokenEqual(input.cookieToken, expectedToken);
  if (!headerAuthenticated && !cookieAuthenticated) return { allowed: false, reason: "missing-session" };

  if (!isReadOnlyMethod(input.method.toUpperCase()) && normalizedOrigin(input.origin) !== allowedOrigin) {
    return { allowed: false, reason: "invalid-origin" };
  }

  return { allowed: true, mode: headerAuthenticated ? "header" : "cookie" };
}

export function localSecurityHeaders(): Record<string, string> {
  return {
    "Content-Security-Policy": [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "form-action 'self'",
      "img-src 'self' data: blob:",
      "style-src 'self' 'unsafe-inline'",
      "script-src 'self' 'unsafe-inline'",
      "connect-src 'self'"
    ].join("; "),
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY"
  };
}
