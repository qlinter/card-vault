import assert from "node:assert/strict";
import test from "node:test";
import { evaluateLocalSessionRequest, localSecurityHeaders, localRequestOrigin } from "../lib/local-session-security.ts";

const baseRequest = {
  expectedToken: "secret-token",
  allowedOrigin: "http://127.0.0.1:3000",
  requestHost: "127.0.0.1:3000",
  method: "GET"
};

test("account origin uses the validated local Host, ignores forwarded hosts and rejects rebinding", () => {
  assert.equal(localRequestOrigin("127.0.0.1:3360", "http:"), "http://127.0.0.1:3360");
  assert.equal(localRequestOrigin("localhost:3360", "http:"), "http://localhost:3360");
  assert.equal(localRequestOrigin("[::1]:3360", "http:"), "http://[::1]:3360");
  for (const host of [null, "attacker.example", "attacker@localhost:3360", "127.0.0.1:3360.evil", "localhost:3361"]) {
    assert.equal(localRequestOrigin(host, "http:", "http://127.0.0.1:3360"), null);
  }
  assert.equal(localRequestOrigin("attacker.example", "http:"), null);
  assert.equal(localRequestOrigin("127.0.0.1:3360", "file:"), null);
});

test("local session protection is disabled for direct development and E2E servers", () => {
  assert.deepEqual(evaluateLocalSessionRequest({ ...baseRequest, expectedToken: undefined }), { allowed: true, mode: "disabled" });
});

test("local session accepts an exact cookie or internal health header", () => {
  assert.deepEqual(evaluateLocalSessionRequest({ ...baseRequest, cookieToken: "secret-token" }), { allowed: true, mode: "cookie" });
  assert.deepEqual(evaluateLocalSessionRequest({ ...baseRequest, headerToken: "secret-token" }), { allowed: true, mode: "header" });
});

test("local session rejects missing tokens, host changes, and cross-origin mutations", () => {
  assert.equal(evaluateLocalSessionRequest(baseRequest).allowed, false);
  assert.deepEqual(
    evaluateLocalSessionRequest({ ...baseRequest, cookieToken: "secret-token", requestHost: "localhost:3000" }),
    { allowed: false, reason: "invalid-host" }
  );
  assert.deepEqual(
    evaluateLocalSessionRequest({ ...baseRequest, method: "POST", cookieToken: "secret-token", origin: "https://attacker.example" }),
    { allowed: false, reason: "invalid-origin" }
  );
  assert.deepEqual(
    evaluateLocalSessionRequest({ ...baseRequest, method: "POST", cookieToken: "secret-token", origin: "http://127.0.0.1:3000" }),
    { allowed: true, mode: "cookie" }
  );
});

test("native forms still require an exact Origin; null and missing origins are rejected", () => {
  for (const origin of [undefined, "null", "https://attacker.example"]) assert.deepEqual(
    evaluateLocalSessionRequest({ ...baseRequest, method: "POST", cookieToken: "secret-token", origin }),
    { allowed: false, reason: "invalid-origin" }
  );
});

test("local responses include baseline browser hardening headers", () => {
  const headers = localSecurityHeaders();
  assert.match(headers["Content-Security-Policy"], /frame-ancestors 'none'/);
  assert.equal(headers["X-Content-Type-Options"], "nosniff");
  assert.equal(headers["Referrer-Policy"], "same-origin");
});
