import { NextRequest, NextResponse } from "next/server";
import { ACCOUNT_COOKIE, createAccountStore } from "@/lib/account-store";
import {
  evaluateLocalSessionRequest,
  localSecurityHeaders,
  localSessionCookieName,
  localSessionHeaderName,
  localRequestOrigin
} from "@/lib/local-session-security";

function withSecurityHeaders(response: NextResponse): NextResponse {
  for (const [name, value] of Object.entries(localSecurityHeaders())) response.headers.set(name, value);
  return response;
}

export function proxy(request: NextRequest): NextResponse {
  const decision = evaluateLocalSessionRequest({
    expectedToken: process.env.CARD_VAULT_SESSION_TOKEN,
    allowedOrigin: process.env.CARD_VAULT_ALLOWED_ORIGIN,
    requestHost: request.headers.get("host"),
    method: request.method,
    origin: request.headers.get("origin"),
    cookieToken: request.cookies.get(localSessionCookieName)?.value,
    headerToken: request.headers.get(localSessionHeaderName)
  });

  if (!decision.allowed) {
    return withSecurityHeaders(new NextResponse("Card Vault local session required.", {
      status: 403,
      headers: { "Cache-Control": "no-store" }
    }));
  }

  const pathname = request.nextUrl.pathname;
  const expectedOrigin = localRequestOrigin(request.headers.get("host"), request.nextUrl.protocol, process.env.CARD_VAULT_ALLOWED_ORIGIN);
  if (!expectedOrigin) {
    return withSecurityHeaders(new NextResponse("Local access required.", { status: 403, headers: { "Cache-Control": "no-store" } }));
  }
  const publicRoute = pathname === "/login" || pathname === "/api/account" || pathname === "/api/health"
    || pathname.startsWith("/_next/static/") || ["/favicon.ico", "/home-bg.webp", "/showcase-bg.webp", "/shares-bg.webp", "/app-themes/gallery.webp", "/app-themes/midnight.webp", "/app-themes/archive.webp"].includes(pathname);
  if (!["GET", "HEAD", "OPTIONS"].includes(request.method) && request.headers.get("origin") !== expectedOrigin) {
    return withSecurityHeaders(NextResponse.json({ error: "invalid-origin" }, { status: 403, headers: { "Cache-Control": "no-store" } }));
  }
  if (!publicRoute && !createAccountStore().status(request.cookies.get(ACCOUNT_COOKIE)?.value).authenticated) {
    const isDocument = ["GET", "HEAD"].includes(request.method) && request.headers.get("sec-fetch-dest") === "document";
    const response = isDocument
      ? NextResponse.redirect(new URL("/login", request.url), 303)
      : NextResponse.json({ error: "login-required" }, { status: 401 });
    response.headers.set("Cache-Control", "no-store, private");
    return withSecurityHeaders(response);
  }
  const response = NextResponse.next();
  if (!pathname.startsWith("/_next/static/")) {
    response.headers.set("Cache-Control", "no-store, private");
    response.headers.set("Pragma", "no-cache");
  }
  return withSecurityHeaders(response);
}

export const config = {
  matcher: ["/((?!favicon.ico).*)"]
};
