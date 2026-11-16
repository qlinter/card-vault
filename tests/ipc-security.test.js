const assert = require("node:assert/strict");
const test = require("node:test");
const { assertTrustedIpcSender, createTrustedIpcRegistrar, ipcSenderUrl, isTrustedIpcSender } = require("../electron/ipc/security");

function eventWithUrl(url) {
  return { senderFrame: { url }, sender: { getURL: () => "http://ignored.test" } };
}

test("IPC sender validation accepts only the current local application origin", () => {
  const baseUrl = "http://127.0.0.1:3007";
  assert.equal(ipcSenderUrl(eventWithUrl(`${baseUrl}/settings`)), `${baseUrl}/settings`);
  assert.equal(isTrustedIpcSender(eventWithUrl(`${baseUrl}/settings`), baseUrl), true);
  assert.equal(isTrustedIpcSender(eventWithUrl("https://attacker.example/settings"), baseUrl), false);
  assert.equal(isTrustedIpcSender({ sender: { getURL: () => baseUrl } }, baseUrl), false);
  assert.throws(() => assertTrustedIpcSender(eventWithUrl("http://127.0.0.1:3008/"), baseUrl), /非 Card Vault/);
});

test("trusted IPC registrar applies sender validation before invoking handlers", async () => {
  let registered;
  const ipcMain = { handle: (channel, handler) => { registered = { channel, handler }; } };
  const register = createTrustedIpcRegistrar(ipcMain, () => "http://127.0.0.1:3007");
  register("card-vault:test", async (_event, value) => value.toUpperCase());

  assert.equal(registered.channel, "card-vault:test");
  assert.equal(await registered.handler(eventWithUrl("http://127.0.0.1:3007/settings"), "ok"), "OK");
  await assert.rejects(registered.handler(eventWithUrl("https://attacker.example"), "no"), /非 Card Vault/);
});

test("protected IPC authorization runs after origin validation and before the operation", async () => {
  let handler, operationCalls = 0, authorizations = 0;
  let loggedIn = false;
  const register = createTrustedIpcRegistrar({ handle: (_channel, callback) => { handler = callback; } }, () => "http://127.0.0.1:3007", async () => {
    authorizations++;
    if (!loggedIn) throw new Error("login required");
  });
  register("protected", async () => { operationCalls++; return "ok"; });
  await assert.rejects(handler(eventWithUrl("https://attacker.example")), /非 Card Vault/);
  assert.equal(authorizations, 0);
  await assert.rejects(handler(eventWithUrl("http://127.0.0.1:3007/login")), /login required/);
  assert.equal(operationCalls, 0);
  loggedIn = true;
  assert.equal(await handler(eventWithUrl("http://127.0.0.1:3007/settings")), "ok");
  loggedIn = false;
  await assert.rejects(handler(eventWithUrl("http://127.0.0.1:3007/settings")), /login required/);
  assert.equal(operationCalls, 1);
});
