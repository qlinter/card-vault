// Real account setup/login for isolated acceptance fixtures. This never disables
// authentication in the application or injects a production bypass.
const fs = require("node:fs");
const path = require("node:path");
const { randomBytes } = require("node:crypto");
const nativeFetch = global.fetch;
const sessions = new Map();
const username = "Acceptance Collector";
const password = "isolated acceptance password 160";

function accountTestEnvironment(env) {
  if (!env.CARD_VAULT_DATA_DIR) throw new Error("An isolated data directory is required for account tests.");
  return { ...env, CARD_VAULT_ACCOUNT_PATH: path.join(path.dirname(env.CARD_VAULT_DATA_DIR), "test-account", "account.json"), CARD_VAULT_ACCOUNT_RUN_ID: randomBytes(32).toString("hex") };
}

async function authenticateTestServer(baseUrl, serviceCookie = "") {
  const origin = new URL(baseUrl).origin;
  let cookie = serviceCookie;
  async function request(action, values = {}) {
    const response = await nativeFetch(origin + "/api/account", {
      method: "POST", headers: { Origin: origin, "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ action, ...values })
    });
    if (!response.ok) throw new Error(`Account fixture ${action} failed (${response.status}): ${await response.text()}`);
    const setCookie = response.headers.getSetCookie().find(value => value.startsWith("card-vault-account="));
    if (setCookie) cookie = [serviceCookie, setCookie.split(";")[0]].filter(Boolean).join("; ");
    return response.json();
  }
  const state = await nativeFetch(origin + "/api/account", { headers: { Cookie: cookie } }).then(response => response.json());
  const result = await request(state.state === "setup" ? "setup" : "login", { username, password });
  if (result.recoveryCode) await request("confirm-recovery", { acknowledged: true });
  sessions.set(origin, cookie);
  global.fetch = async (url, options = {}) => {
    const target = new URL(url instanceof Request ? url.url : String(url));
    const session = sessions.get(target.origin);
    if (!session) return nativeFetch(url, options);
    const headers = new Headers(url instanceof Request ? url.headers : undefined);
    new Headers(options.headers).forEach((value, key) => headers.set(key, value));
    if (!headers.has("cookie")) headers.set("Cookie", session);
    if (!["GET", "HEAD", "OPTIONS"].includes((options.method || (url instanceof Request ? url.method : "GET")).toUpperCase()) && !headers.has("origin")) headers.set("Origin", target.origin);
    return nativeFetch(url, { ...options, headers });
  };
  return cookie;
}

function testAccountCookies(baseUrl) {
  const origin = new URL(baseUrl).origin;
  const cookie = sessions.get(origin);
  if (!cookie) throw new Error("The acceptance fixture has not signed in.");
  return cookie.split("; ").map(entry => {
    const separator = entry.indexOf("=");
    return { name: entry.slice(0, separator), value: entry.slice(separator + 1), url: origin, httpOnly: true, sameSite: "Strict" };
  });
}

function writeAccountStorageState(baseUrl, filePath) {
  const origin = new URL(baseUrl);
  const cookies = testAccountCookies(baseUrl).map(cookie => {
    const stored = { ...cookie }; delete stored.url;
    return { ...stored, domain: origin.hostname, path: "/", secure: origin.protocol === "https:", expires: -1 };
  });
  fs.writeFileSync(filePath, JSON.stringify({ cookies, origins: [] }));
}

async function signInTestPage(page) {
  const origin = new URL(page.url()).origin;
  const state = await page.request.get(origin + "/api/account").then(response => response.json());
  const response = await page.request.post(origin + "/api/account", { headers: { Origin: origin }, data: { action: state.state === "setup" ? "setup" : "login", username, password } });
  if (!response.ok()) throw new Error(`Desktop account fixture failed: ${await response.text()}`);
  const result = await response.json();
  if (result.recoveryCode) {
    const confirmation = await page.request.post(origin + "/api/account", { headers: { Origin: origin }, data: { action: "confirm-recovery", acknowledged: true } });
    if (!confirmation.ok()) throw new Error("Desktop recovery acknowledgement failed.");
  }
}

module.exports = { accountTestEnvironment, authenticateTestServer, testAccountCookies, writeAccountStorageState, signInTestPage };
