const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { createAccountStore, AccountError } = require("../lib/account-store");

const pass = "a long local passphrase 123";
function fixture(t, options = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "card-vault-account-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const config = { filePath: path.join(root, "config", "account.json"), runId: "first-run", ...options };
  return { store: createAccountStore(config), config, root };
}
async function setup(store) {
  const result = await store.execute("setup", { username: "Collector", password: pass });
  await store.execute("confirm-recovery", { acknowledged: true }, result.token);
  return result;
}
const code = value => error => error instanceof AccountError && error.code === value;

test("first setup requires recovery acknowledgement and stores only salted hashes", async t => {
  const { store, config } = fixture(t);
  assert.deepEqual(store.status(), { state: "setup", authenticated: false });
  const result = await store.execute("setup", { username: "Collector", password: pass });
  assert.equal(store.status(result.token).authenticated, false);
  await assert.rejects(store.execute("change-username", { currentPassword: pass, username: "Newname" }, result.token), code("login-required"));
  await assert.rejects(store.execute("confirm-recovery", { acknowledged: false }, result.token), code("confirmation-required"));
  await store.execute("confirm-recovery", { acknowledged: true }, result.token);
  assert.equal(store.status(result.token).authenticated, true);
  const raw = fs.readFileSync(config.filePath, "utf8");
  for (const secret of [pass, result.token, result.recoveryCode]) assert.equal(raw.includes(secret), false);
  await assert.rejects(store.execute("setup", { username: "Other", password: pass }), code("already-configured"));
});

test("refresh and local-service restart preserve login; full application restart revokes it", async t => {
  const { store, config } = fixture(t), result = await setup(store);
  assert.equal(createAccountStore(config).status(result.token).authenticated, true);
  assert.equal(createAccountStore({ ...config, runId: "next-app-run" }).status(result.token).authenticated, false);
  assert.equal(store.status(result.token + "x").authenticated, false);
  assert.equal(store.status("forged").authenticated, false);
});

test("system lock, logout and a new login invalidate old tokens", async t => {
  const { store } = fixture(t), first = await setup(store);
  await store.lock(); assert.equal(store.status(first.token).authenticated, false);
  const second = await store.execute("login", { username: "collector", password: pass });
  assert.notEqual(second.token, first.token); assert.equal(store.status(second.token).authenticated, true);
  const third = await store.execute("login", { username: "COLLECTOR", password: pass });
  assert.equal(store.status(second.token).authenticated, false);
  await store.execute("logout", {}, third.token);
  assert.equal(store.status(third.token).authenticated, false);
});

test("manual lock is not an account action and leaves a valid session intact", async t => {
  const { store } = fixture(t), result = await setup(store);
  await assert.rejects(store.execute("lock", {}, result.token), code("invalid-action"));
  assert.equal(store.status(result.token).authenticated, true);
});

test("password change verifies the current password and revokes all sessions", async t => {
  const { store } = fixture(t), initial = await setup(store), nextPass = "a different long password";
  await assert.rejects(store.execute("change-password", { currentPassword: "wrong", password: nextPass }, initial.token), code("incorrect-credentials"));
  await store.execute("change-password", { currentPassword: pass, password: nextPass }, initial.token);
  assert.equal(store.status(initial.token).authenticated, false);
  await assert.rejects(store.execute("login", { username: "Collector", password: pass }), code("incorrect-credentials"));
  const login = await store.execute("login", { username: "Collector", password: nextPass });
  assert.equal(store.status(login.token).authenticated, true);
});

test("recovery codes are one-use, rotate after reset and cannot enter before acknowledgement", async t => {
  const { store } = fixture(t), initial = await setup(store), nextPass = "a recovered password 123";
  const recovered = await store.execute("recover", { recoveryCode: initial.recoveryCode.toLowerCase(), password: nextPass });
  assert.equal(store.status(initial.token).authenticated, false);
  assert.equal(store.status(recovered.token).authenticated, false);
  assert.notEqual(recovered.recoveryCode, initial.recoveryCode);
  await assert.rejects(store.execute("recover", { recoveryCode: initial.recoveryCode, password: pass }), code("incorrect-credentials"));
  const confirmed = await store.execute("confirm-recovery", { acknowledged: true }, recovered.token);
  assert.equal(confirmed.logout, true);
  const login = await store.execute("login", { username: recovered.username, password: nextPass });
  assert.equal(store.status(login.token).authenticated, true);
});

test("interrupted first-run confirmation is recoverable with the password", async t => {
  const { store } = fixture(t);
  const initial = await store.execute("setup", { username: "Collector", password: pass });
  const login = await store.execute("login", { username: "Collector", password: pass });
  assert.notEqual(login.recoveryCode, initial.recoveryCode);
  await assert.rejects(store.execute("confirm-recovery", { acknowledged: true }, initial.token), code("login-required"));
  await store.execute("confirm-recovery", { acknowledged: true }, login.token);
  assert.equal(store.status(login.token).authenticated, true);
});

test("username and recovery-code changes require the current password", async t => {
  const { store } = fixture(t), initial = await setup(store);
  await assert.rejects(store.execute("change-username", { currentPassword: "bad", username: "Other" }, initial.token), code("incorrect-credentials"));
  await store.execute("change-username", { currentPassword: pass, username: "Other" }, initial.token);
  assert.equal(store.status(initial.token).username, "Other");
  const rotated = await store.execute("rotate-recovery", { currentPassword: pass }, initial.token);
  assert.equal(store.status(initial.token).authenticated, false);
  assert.equal(store.status(initial.token).recoveryPending, undefined);
  assert.equal(store.status().recoveryPending, undefined);
  assert.equal(store.status(rotated.token).authenticated, false);
  assert.equal(store.status(rotated.token).recoveryPending, true);
  await assert.rejects(store.execute("change-username", { currentPassword: pass, username: "Blocked" }, rotated.token), code("login-required"));
  await store.execute("confirm-recovery", { acknowledged: true }, rotated.token);
  assert.equal(store.status(rotated.token).recoveryPending, undefined);
  await assert.rejects(store.execute("recover", { recoveryCode: initial.recoveryCode, password: pass }), code("incorrect-credentials"));
});

test("throttling persists across store instances and resets after a successful login", async t => {
  let now = 1000000;
  const { store, config } = fixture(t, { now: () => now }); await setup(store);
  for (let attempt = 0; attempt < 5; attempt++) await assert.rejects(store.execute("login", { username: "Collector", password: "bad" }), code("incorrect-credentials"));
  await assert.rejects(createAccountStore(config).execute("login", { username: "Collector", password: pass }), error => error.code === "try-later" && error.retryAfter === 1);
  now += 1001;
  const login = await store.execute("login", { username: "Collector", password: pass });
  assert.equal(store.status(login.token).authenticated, true);
  await assert.rejects(store.execute("login", { username: "Wrongname", password: pass }), code("incorrect-credentials"));
});

test("corrupt, malformed or missing initialized account fails closed", async t => {
  const { store, config } = fixture(t); await setup(store);
  const original = fs.readFileSync(config.filePath, "utf8");
  for (const raw of ["", "{", "{}", original.replace('"version":1', '"version":2')]) {
    fs.writeFileSync(config.filePath, raw);
    assert.deepEqual(store.status(), { state: "unavailable", authenticated: false });
    await assert.rejects(store.execute("setup", { username: "Other", password: pass }), code("account-unavailable"));
  }
  fs.rmSync(config.filePath);
  assert.equal(store.status().state, "unavailable");
});

test("input limits support long Unicode passphrases and reject malformed values", async t => {
  const { store } = fixture(t);
  for (const value of ["short", "a".repeat(129), 42, null]) await assert.rejects(store.execute("setup", { username: "Collector", password: value }), code("invalid-password"));
  for (const value of ["ab", "a\nname", "a".repeat(65), null]) await assert.rejects(store.execute("setup", { username: value, password: pass }), code("invalid-username"));
  const unicode = "这是能够记住的中文密码长句和空格 123";
  const result = await store.execute("setup", { username: "我的收藏家", password: unicode });
  await store.execute("confirm-recovery", { acknowledged: true }, result.token);
  await store.execute("login", { username: "我的收藏家", password: unicode });
});

test("password boundaries apply to setup, change and recovery using Unicode character counts", async t => {
  const { store } = fixture(t);
  const minimum = "12345678", maximum = "😀".repeat(128), recoveredPassword = "卡".repeat(8);
  for (const value of ["", "a".repeat(7), "a".repeat(129), "😀".repeat(7), "😀".repeat(129)]) {
    await assert.rejects(store.execute("setup", { username: "Collector", password: value }), code("invalid-password"));
    assert.equal(store.status().state, "setup");
  }
  const initial = await store.execute("setup", { username: "Collector", password: minimum });
  await store.execute("confirm-recovery", { acknowledged: true }, initial.token);
  for (const value of ["a".repeat(7), "😀".repeat(129)]) {
    await assert.rejects(store.execute("change-password", { currentPassword: minimum, password: value }, initial.token), code("invalid-password"));
    await assert.rejects(store.execute("recover", { recoveryCode: initial.recoveryCode, password: value }), code("invalid-password"));
  }
  await store.execute("change-password", { currentPassword: minimum, password: maximum }, initial.token);
  const login = await store.execute("login", { username: "Collector", password: maximum });
  assert.equal(store.status(login.token).authenticated, true);
  const recovered = await store.execute("recover", { recoveryCode: initial.recoveryCode, password: recoveredPassword });
  await store.execute("confirm-recovery", { acknowledged: true }, recovered.token);
  const final = await store.execute("login", { username: "Collector", password: recoveredPassword });
  assert.equal(store.status(final.token).authenticated, true);
});

test("simultaneous setup and recovery requests cannot overwrite each other", async t => {
  const { store, config } = fixture(t);
  const settled = await Promise.allSettled([store.execute("setup", { username: "First", password: pass }), createAccountStore(config).execute("setup", { username: "Other", password: pass })]);
  assert.equal(settled.filter(result => result.status === "fulfilled").length, 1);
  const first = settled.find(result => result.status === "fulfilled").value;
  const resets = await Promise.allSettled([store.execute("recover", { recoveryCode: first.recoveryCode, password: pass }), createAccountStore(config).execute("recover", { recoveryCode: first.recoveryCode, password: pass })]);
  assert.equal(resets.filter(result => result.status === "fulfilled").length, 1);
});

test("a dead account-writer process does not block future login", async t => {
  const { store, config } = fixture(t); await setup(store);
  fs.writeFileSync(config.filePath + ".lock", "2147483647");
  const login = await store.execute("login", { username: "Collector", password: pass });
  assert.equal(store.status(login.token).authenticated, true);
});
