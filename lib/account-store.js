const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { createHash, randomBytes, scrypt, timingSafeEqual } = require("node:crypto");
const passwordPolicy = require("./account-password-policy.json");

const ACCOUNT_COOKIE = "card-vault-account";
const KDF = Object.freeze({ N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 });

class AccountError extends Error {
  constructor(code, status = 400, retryAfter = 0) {
    super(code);
    this.code = code;
    this.status = status;
    this.retryAfter = retryAfter;
  }
}

function defaultAccountPath() {
  if (process.env.CARD_VAULT_ACCOUNT_PATH) return path.resolve(process.env.CARD_VAULT_ACCOUNT_PATH);
  const configRoot = process.platform === "win32" ? process.env.APPDATA || os.homedir() : process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config");
  return path.join(configRoot, "Card Vault Web", "account.json");
}

function runtimeId() {
  // Shared by all Next bundles in this process; Electron supplies its own run ID
  // so a local-service restart does not sign the user out.
  process.env.CARD_VAULT_ACCOUNT_RUN_ID ||= randomBytes(32).toString("hex");
  return process.env.CARD_VAULT_ACCOUNT_RUN_ID;
}

const digest = value => createHash("sha256").update(value).digest("hex");
function equal(left, right) {
  if (typeof left !== "string" || typeof right !== "string") return false;
  const a = Buffer.from(left), b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}
function username(value) {
  if (typeof value !== "string") throw new AccountError("invalid-username");
  const name = value.normalize("NFKC").trim();
  if (Array.from(name).length < 3 || Array.from(name).length > 64 || /[\p{Cc}\p{Cf}]/u.test(name)) throw new AccountError("invalid-username");
  return name;
}
function password(value) {
  if (typeof value !== "string" || Array.from(value).length < passwordPolicy.minLength || Array.from(value).length > passwordPolicy.maxLength) throw new AccountError("invalid-password");
  return value;
}
function derive(value, salt) {
  return new Promise((resolve, reject) => scrypt(value, Buffer.from(salt, "hex"), 64, KDF, (error, key) => error ? reject(error) : resolve(key.toString("hex"))));
}
async function credential(value) {
  const salt = randomBytes(32).toString("hex");
  return { salt, hash: await derive(value, salt) };
}
const recoveryCode = () => randomBytes(20).toString("hex").toUpperCase().match(/.{1,5}/g).join("-");
const recoveryDigest = value => digest(String(value || "").replace(/[\s-]/g, "").toUpperCase());

function createAccountStore({ filePath = defaultAccountPath(), runId = runtimeId(), now = Date.now } = {}) {
  filePath = path.resolve(filePath);
  const markerPath = filePath + ".initialized";
  const lockPath = filePath + ".lock";

  function read() {
    try {
      const raw = fs.readFileSync(filePath, "utf8");
      if (Buffer.byteLength(raw) > 16_384) throw new Error("size");
      const data = JSON.parse(raw);
      if (data.version !== 1 || username(data.username) !== data.username || !/^[a-f0-9]{64}$/.test(data.password?.salt) || !/^[a-f0-9]{128}$/.test(data.password?.hash) || !/^[a-f0-9]{64}$/.test(data.recoveryHash) || typeof data.recoveryAcknowledged !== "boolean" || !Number.isSafeInteger(data.revision) || data.revision < 1 || !Number.isSafeInteger(data.failures) || data.failures < 0 || !Number.isFinite(data.blockedUntil) || !Number.isFinite(data.lastFailure)) throw new Error("shape");
      if (data.session !== null && (!/^[a-f0-9]{64}$/.test(data.session?.hash) || typeof data.session.runId !== "string" || typeof data.session.confirmed !== "boolean" || !["setup", "login", "recover", "rotate"].includes(data.session.purpose))) throw new Error("session");
      return data;
    } catch (error) {
      if (error.code === "ENOENT" && !fs.existsSync(markerPath)) return null;
      throw new AccountError("account-unavailable", 503);
    }
  }

  function write(data) {
    const temporary = filePath + "." + randomBytes(8).toString("hex") + ".tmp";
    try {
      fs.mkdirSync(path.dirname(filePath), { recursive: true, mode: 0o700 });
      // A missing/corrupt initialized account must never become a new setup.
      const marker = fs.openSync(markerPath, "a", 0o600);
      fs.fsyncSync(marker); fs.closeSync(marker);
      const handle = fs.openSync(temporary, "wx", 0o600);
      try { fs.writeFileSync(handle, JSON.stringify(data)); fs.fsyncSync(handle); } finally { fs.closeSync(handle); }
      fs.renameSync(temporary, filePath);
    } catch {
      throw new AccountError("account-unavailable", 503);
    } finally {
      fs.rmSync(temporary, { force: true });
    }
  }

  async function exclusive(action) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true, mode: 0o700 });
    const deadline = performance.now() + 10_000;
    let handle;
    while (handle === undefined) {
      try {
        handle = fs.openSync(lockPath, "wx", 0o600);
        fs.writeFileSync(handle, String(process.pid));
      } catch (error) {
        if (handle !== undefined) { fs.closeSync(handle); fs.rmSync(lockPath, { force: true }); throw new AccountError("account-unavailable", 503); }
        if (error.code !== "EEXIST") throw new AccountError("account-unavailable", 503);
        // A terminated process cannot leave account management permanently busy.
        try {
          const owner = Number(fs.readFileSync(lockPath, "utf8"));
          if (Number.isSafeInteger(owner) && owner > 0) {
            try { process.kill(owner, 0); } catch (probe) { if (probe.code === "ESRCH") fs.rmSync(lockPath, { force: true }); }
          }
        } catch { /* Another process may already have released the lock. */ }
        if (performance.now() >= deadline) throw new AccountError("account-busy", 503);
        await new Promise(resolve => setTimeout(resolve, 25));
      }
    }
    try { return await action(); } finally { fs.closeSync(handle); fs.rmSync(lockPath, { force: true }); }
  }

  function sessionMatches(data, token, confirmed = true) {
    return typeof token === "string" && /^[A-Za-z0-9_-]{43}$/.test(token) && data?.session?.runId === runId && (!confirmed || data.session.confirmed) && equal(data.session.hash, digest(token));
  }
  function requireSession(data, token, confirmed = true) {
    if (!sessionMatches(data, token, confirmed)) throw new AccountError("login-required", 401);
  }
  function startSession(data, purpose, confirmed) {
    const token = randomBytes(32).toString("base64url");
    data.session = { hash: digest(token), runId, purpose, confirmed };
    return token;
  }
  function checkThrottle(data) {
    if (data.blockedUntil > now()) throw new AccountError("try-later", 429, Math.ceil((data.blockedUntil - now()) / 1000));
  }
  function failed(data) {
    data.failures = now() - data.lastFailure > 15 * 60_000 ? 1 : Math.min(20, data.failures + 1);
    data.lastFailure = now();
    data.blockedUntil = now() + (data.failures >= 5 ? Math.min(60_000, 1000 * 2 ** (data.failures - 5)) : 0);
    write(data);
    throw new AccountError("incorrect-credentials", 401);
  }
  async function verifyPassword(data, value) {
    checkThrottle(data);
    const candidate = typeof value === "string" && value.length <= 512 ? value : "";
    if (!equal(await derive(candidate, data.password.salt), data.password.hash)) failed(data);
  }
  function resetFailures(data) { data.failures = 0; data.blockedUntil = 0; data.lastFailure = 0; }
  function save(data) { data.revision++; write(data); }

  function status(token) {
    try {
      const data = read();
      if (!data) return { state: "setup", authenticated: false };
      const authenticated = sessionMatches(data, token);
      const recoveryPending = !authenticated && sessionMatches(data, token, false);
      return { state: "ready", authenticated, ...(authenticated ? { username: data.username } : {}), ...(recoveryPending ? { recoveryPending: true } : {}) };
    } catch { return { state: "unavailable", authenticated: false }; }
  }

  async function execute(action, input = {}, token) {
    return exclusive(async () => {
      let data = read();
      if (action === "setup") {
        if (data) throw new AccountError("already-configured", 409);
        const name = username(input.username), pass = password(input.password), code = recoveryCode();
        data = { version: 1, revision: 1, username: name, password: await credential(pass), recoveryHash: recoveryDigest(code), recoveryAcknowledged: false, failures: 0, blockedUntil: 0, lastFailure: 0, session: null };
        const nextToken = startSession(data, "setup", false);
        write(data);
        return { token: nextToken, recoveryCode: code };
      }
      if (!data) throw new AccountError("setup-required", 409);
      if (action === "login") {
        await verifyPassword(data, input.password);
        if (typeof input.username !== "string" || input.username.normalize("NFKC").trim().toLowerCase() !== data.username.toLowerCase()) failed(data);
        resetFailures(data);
        let code;
        if (!data.recoveryAcknowledged) { code = recoveryCode(); data.recoveryHash = recoveryDigest(code); }
        const nextToken = startSession(data, "login", data.recoveryAcknowledged);
        save(data);
        return { token: nextToken, ...(code ? { recoveryCode: code } : {}) };
      }
      if (action === "recover") {
        password(input.password);
        checkThrottle(data);
        if (typeof input.recoveryCode !== "string" || input.recoveryCode.length > 128 || !equal(recoveryDigest(input.recoveryCode), data.recoveryHash)) failed(data);
        data.password = await credential(input.password);
        const code = recoveryCode(); data.recoveryHash = recoveryDigest(code); data.recoveryAcknowledged = false;
        resetFailures(data);
        const nextToken = startSession(data, "recover", false);
        save(data);
        return { token: nextToken, recoveryCode: code, username: data.username };
      }
      if (action === "confirm-recovery") {
        requireSession(data, token, false);
        if (input.acknowledged !== true || data.session.confirmed) throw new AccountError("confirmation-required");
        const logout = ["recover", "rotate"].includes(data.session.purpose);
        data.recoveryAcknowledged = true;
        data.session = logout ? null : { ...data.session, confirmed: true };
        save(data);
        return { logout };
      }
      requireSession(data, token);
      if (action === "logout") { data.session = null; save(data); return { logout: true }; }
      if (!["change-username", "change-password", "rotate-recovery"].includes(action)) throw new AccountError("invalid-action");
      await verifyPassword(data, input.currentPassword);
      resetFailures(data);
      if (action === "change-username") { data.username = username(input.username); save(data); return { username: data.username }; }
      if (action === "change-password") { data.password = await credential(password(input.password)); data.session = null; save(data); return { logout: true }; }
      const code = recoveryCode();
      data.recoveryHash = recoveryDigest(code); data.recoveryAcknowledged = false;
      const nextToken = startSession(data, "rotate", false);
      save(data);
      return { token: nextToken, recoveryCode: code };
    });
  }

  async function lock() {
    return exclusive(() => { const data = read(); if (data?.session) { data.session = null; save(data); } });
  }
  return { status, execute, lock, filePath };
}

module.exports = { ACCOUNT_COOKIE, AccountError, createAccountStore, defaultAccountPath };
