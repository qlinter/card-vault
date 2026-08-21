import { NextRequest, NextResponse } from "next/server";
import {
  evaluateLocalSessionRequest,
  localSecurityHeaders,
  localSessionCookieName,
  localSessionHeaderName
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

  return withSecurityHeaders(NextResponse.next());
}

export const config = {
  matcher: ["/((?!favicon.ico).*)"]
};
