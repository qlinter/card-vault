const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { _electron: electron, expect } = require("@playwright/test");
const { initializeDatabase } = require("./database-schema");
const { DatabaseSync } = require("node:sqlite");
const { signInTestPage } = require("./test-account-helpers");

async function main() {
  const executable = process.argv[2] ? path.resolve(process.argv[2]) : require("electron");
  const launchArgs = process.argv[2] ? [] : [path.resolve(__dirname, "..")];
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "card-vault-account-desktop-"));
  const dbPath = path.join(root, "data", "dev.db");
  initializeDatabase(dbPath);
  const db = new DatabaseSync(dbPath);
  db.prepare("INSERT INTO Card(id,playerName,cardTitle,sport,visibility) VALUES('native-account','Desktop Protected Card','Account fixture','Basketball','private')").run(); db.close();
  const env = { ...process.env, CARD_VAULT_USER_DATA_DIR: root, CARD_VAULT_ACCEPTANCE_MODE: "1" }; delete env.ELECTRON_RUN_AS_NODE;
  let app;
  const launch = async () => {
    const logPath = path.join(root, "logs", "desktop.log");
    const offset = fs.existsSync(logPath) ? fs.readFileSync(logPath, "utf8").length : 0;
    app = await electron.launch({ executablePath: executable, args: launchArgs, env, timeout: 60000 });
    await expect.poll(() => fs.existsSync(logPath) && fs.readFileSync(logPath, "utf8").slice(offset).includes("Desktop app boot completed."), { timeout: 60000 }).toBe(true);
    const page = await app.firstWindow(); await page.waitForLoadState("networkidle");
    return page;
  };
  try {
    const page = await launch();
    const errors = []; page.on("pageerror", error => errors.push(error.message));
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.locator(".topbar")).toHaveCount(0);
    const deniedIpc = () => page.evaluate(async () => {
      const results = [];
      for (const name of ["getAiSettings", "getBackupSettings", "checkDataHealth"]) {
        try { await window.cardVaultDesktop[name](); results.push("allowed"); } catch { results.push("denied"); }
      }
      return results;
    });
    assert.deepEqual(await deniedIpc(), ["denied", "denied", "denied"]);
    await signInTestPage(page);
    const origin = new URL(page.url()).origin;
    await page.goto(origin);
    await expect(page.getByText("Desktop Protected Card", { exact: true }).first()).toBeVisible();
    assert.ok((await page.evaluate(() => window.cardVaultDesktop.getAiSettings())).provider);
    await page.reload(); await expect(page.locator(".topbar")).toBeVisible();
    // Exercise the same main-process event listener used by Windows, without
    // locking the developer's actual Windows session.
    await app.evaluate(({ powerMonitor }) => powerMonitor.emit("lock-screen"));
    await expect.poll(() => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isVisible())).toBe(false);
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.locator(".topbar")).toHaveCount(0);
    assert.deepEqual(await deniedIpc(), ["denied", "denied", "denied"]);
    await app.evaluate(({ powerMonitor }) => powerMonitor.emit("unlock-screen"));
    await expect(page).toHaveURL(/\/login$/);
    await signInTestPage(page); await page.goto(origin);
    await page.goto(origin + "/?export=1");
    const csvPath = path.join(root, "protected.csv");
    await app.evaluate(({ BrowserWindow }, destination) => {
      globalThis.accountDownloadState = "waiting";
      BrowserWindow.getAllWindows()[0].webContents.session.once("will-download", (_event, item) => {
        item.setSavePath(destination);
        item.once("done", (_done, state) => { globalThis.accountDownloadState = state; });
      });
    }, csvPath);
    await page.getByRole("button", { name: "CSV", exact: true }).click();
    await expect.poll(() => app.evaluate(() => globalThis.accountDownloadState), { timeout: 30000 }).toBe("completed");
    assert.ok(fs.readFileSync(csvPath, "utf8").includes("Desktop Protected Card"));
    await page.goto(origin);
    const backup = await page.evaluate(() => window.cardVaultDesktop.backupDataFolder());
    assert.ok(backup.backupPath && fs.existsSync(backup.backupPath));
    const backupFiles = fs.readdirSync(backup.backupPath, { recursive: true });
    assert.equal(backupFiles.some(file => /account\.json/.test(file)), false, "Collection backups must not carry accounts.");
    await expect(page.locator(".topbar")).toBeVisible();
    assert.ok((await page.evaluate(() => window.cardVaultDesktop.getBackupSettings())).path);
    let delayedStatus = 0;
    await page.route("**/api/account", route => {
      const locked = JSON.parse(fs.readFileSync(path.join(root, "account.json"), "utf8")).session === null;
      if (route.request().method() === "GET" && locked && delayedStatus++ < 2) return route.abort();
      return route.continue();
    });
    await expect(page.locator(".header-utilities .header-tool")).toHaveCount(2);
    await page.getByRole("link", { name: "设置", exact: true }).click();
    await expect(page.getByRole("button", { name: "展开账户与安全", exact: true })).toHaveAttribute("aria-expanded", "false");
    await expect(page.getByRole("button", { name: "锁定", exact: true })).toHaveCount(0);
    assert.equal(await page.evaluate(() => "lockAccount" in window.cardVaultDesktop), false);
    await page.getByRole("button", { name: "退出登录", exact: true }).click();
    await expect(page.locator(".account-lock-cover")).toBeVisible();
    await expect(page).toHaveURL(/\/login$/, { timeout: 30000 });
    assert.ok(delayedStatus >= 2);
    await page.unroute("**/api/account");
    await signInTestPage(page); await page.goto(origin);
    const cookie = (await page.context().cookies()).find(item => item.name === "card-vault-account");
    assert.equal((await page.request.get(origin + "/api/cards")).status(), 200, "The replayed token must be valid immediately before quitting.");
    await app.close(); app = null;
    const reopened = await launch();
    await expect(reopened).toHaveURL(/\/login$/);
    await reopened.context().addCookies([{ ...cookie, domain: new URL(reopened.url()).hostname }]);
    await reopened.reload();
    await expect(reopened).toHaveURL(/\/login$/);
    await signInTestPage(reopened); await reopened.goto(new URL(reopened.url()).origin);
    await expect(reopened.getByText("Desktop Protected Card", { exact: true }).first()).toBeVisible();
    assert.deepEqual(errors, []);
    console.log("Account desktop passed: anonymous IPC denial, protected collection, refresh, simulated Windows lock/unlock, native CSV form, backup/service restart, account-free backup, sign-out service reconnection and full-restart token rejection.");
  } finally {
    if (app) await app.close();
    assert.equal(path.dirname(path.resolve(root)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(root).startsWith("card-vault-account-desktop-"));
    fs.rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 });
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
