import { NextRequest, NextResponse } from "next/server";
import { ACCOUNT_COOKIE, GUEST_COOKIE, AccountError, createAccountStore } from "@/lib/account-store";
import { localRequestOrigin } from "@/lib/local-session-security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store, private", "Pragma": "no-cache" };

export function GET(request: NextRequest) {
  const status = createAccountStore().status(request.cookies.get(ACCOUNT_COOKIE)?.value, request.cookies.get(GUEST_COOKIE)?.value);
  return NextResponse.json(status, { headers, status: status.state === "unavailable" ? 503 : 200 });
}

export async function POST(request: NextRequest) {
  const expectedOrigin = localRequestOrigin(request.headers.get("host"), request.nextUrl.protocol, process.env.CARD_VAULT_ALLOWED_ORIGIN);
  if (!expectedOrigin || request.headers.get("origin") !== expectedOrigin || request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") {
    return NextResponse.json({ error: "invalid-origin" }, { status: 403, headers });
  }
  try {
    if (Number(request.headers.get("content-length")) > 8192) throw new AccountError("invalid-request");
    const reader = request.body?.getReader();
    if (!reader) throw new AccountError("invalid-request");
    const chunks: Uint8Array[] = []; let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 8192) { await reader.cancel(); throw new AccountError("invalid-request"); }
      chunks.push(value);
    }
    let input;
    try { input = JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { throw new AccountError("invalid-request"); }
    if (!input || typeof input !== "object" || Array.isArray(input) || typeof input.action !== "string") throw new AccountError("invalid-request");
    const result = await createAccountStore().execute(input.action, input, request.cookies.get(ACCOUNT_COOKIE)?.value, request.cookies.get(GUEST_COOKIE)?.value);
    const { token, guestToken, clearGuest, ...payload } = result;
    const response = NextResponse.json(payload, { headers });
    const cookieOptions = { httpOnly: true, sameSite: "strict" as const, secure: request.nextUrl.protocol === "https:", path: "/" };
    if (token || result.logout || clearGuest) response.headers.set("Clear-Site-Data", '"cache"');
    if (token || result.logout) response.cookies.set(ACCOUNT_COOKIE, token || "", {
      ...cookieOptions,
      ...(result.logout ? { maxAge: 0 } : {})
    });
    if (guestToken || clearGuest || token || result.logout) response.cookies.set(GUEST_COOKIE, guestToken || "", {
      ...cookieOptions, ...(!guestToken ? { maxAge: 0 } : {})
    });
    return response;
  } catch (error) {
    const problem = error instanceof AccountError ? error : { code: "account-unavailable", status: 503, retryAfter: 0 };
    return NextResponse.json({ error: problem.code, retryAfter: problem.retryAfter }, {
      status: problem.status, headers: { ...headers, ...(problem.retryAfter ? { "Retry-After": String(problem.retryAfter) } : {}) }
    });
  }
}
