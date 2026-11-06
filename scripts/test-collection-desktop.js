const assert = require("node:assert/strict");
const fs = require("node:fs"), os = require("node:os"), path = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const { _electron: electron, expect } = require("@playwright/test");
const { initializeDatabase } = require("./database-schema");

const project = path.resolve(__dirname, ".."), development = process.argv.includes("--development");
const executable = development ? require("electron") : path.resolve(process.argv[2] || "dist/win-unpacked/Card Vault.exe");
const root = path.resolve(fs.mkdtempSync(path.join(os.tmpdir(), "card-vault-collection-desktop-")));
assert.equal(path.dirname(root), path.resolve(os.tmpdir())); assert.ok(path.basename(root).startsWith("card-vault-collection-desktop-"));

async function run(locale) {
  const userData = path.join(root, locale), data = path.join(userData, "data"), dbPath = path.join(data, "dev.db");
  initializeDatabase(dbPath); fs.mkdirSync(path.join(data, "uploads"), { recursive: true });
  fs.copyFileSync(path.join(project, "tests/fixtures/ui-media/showcase-bg.webp"), path.join(data, "uploads/fixture.webp"));
  const db = new DatabaseSync(dbPath);
  db.exec(`INSERT INTO Card(id,playerName,cardTitle,sport,visibility,createdAt) VALUES('a','Desktop Alpha','Desktop Card','Basketball','public','2026-01-01T00:00:00Z');
    INSERT INTO CardImage(id,cardId,path,rotation) VALUES('image','a','/media/fixture.webp',90);
    INSERT INTO CardTransaction(id,cardId,kind,amountMinor,currency,quantity,occurredAt,provenance) VALUES('buy','a','purchase',100,'CNY',2,'2026-01-01T00:00:00Z','acceptance');`); db.close();
  const env = { ...process.env, CARD_VAULT_USER_DATA_DIR: userData, CARD_VAULT_ACCEPTANCE_MODE: "1" }; delete env.ELECTRON_RUN_AS_NODE;
  const l = (zh, en) => locale === "en" ? en : zh; let desktop;
  const launch = async () => {
    const logPath = path.join(userData, "logs/desktop.log"), offset = fs.existsSync(logPath) ? fs.readFileSync(logPath, "utf8").length : 0;
    const app = await electron.launch({ executablePath: executable, args: development ? [project] : [], env, timeout: 60000 }); desktop = app;
    await expect.poll(() => fs.existsSync(logPath) && fs.readFileSync(logPath, "utf8").slice(offset).includes("Desktop app boot completed."), { timeout: 60000 }).toBe(true);
    const page = await app.firstWindow(); await page.waitForLoadState("networkidle");
    const origin = new URL(page.url()).origin;
    await page.context().addCookies([{ name: "card_vault_ui_locale", value: locale, url: origin }]);
    await page.goto(origin + "/portfolio/recap?recapYear=2026", { waitUntil: "networkidle" });
    return page;
  };
  try {
    const page = await launch(); await expect(page.locator(".recap-stats strong").first()).toHaveText("2");
    await page.getByLabel(l("月份", "Month"), { exact: true }).selectOption("1");
    await expect(page.getByLabel(l("回顾标题", "Recap Title"), { exact: true })).toHaveValue(l("2026年1月收藏回顾", "January 2026 Collection Recap"));
    const savedUrl = page.url();
    await page.getByRole("button", { name: l("赏卡：本期全部", "View All Cards in This Period"), exact: true }).click();
    const viewer = page.getByRole("dialog", { name: l("沉浸式赏卡", "Immersive Viewing"), exact: true }), stage = viewer.locator(".immersive-stage");
    await expect(viewer.getByRole("button", { name: l("播放", "Play"), exact: true })).toBeEnabled();
    await viewer.getByRole("button", { name: l("全屏", "Full Screen"), exact: true }).click();
    await expect.poll(() => page.evaluate(() => document.fullscreenElement?.className)).toBe("immersive-surface");
    await expect.poll(() => desktop.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isFullScreen())).toBe(true);
    await expect.poll(() => page.evaluate(() => {
      const surface = document.fullscreenElement, rect = surface.getBoundingClientRect();
      return rect.x === 0 && rect.y === 0 && rect.width === innerWidth && rect.height === innerHeight && [.05, .5, .95].every(x => [.05, .5, .95].every(y => surface.contains(document.elementFromPoint(innerWidth * x, innerHeight * y))));
    })).toBe(true);
    await viewer.getByRole("button", { name: l("展馆设置", "Gallery Settings"), exact: true }).click();
    const stylePicker = viewer.getByRole("combobox", { name: l("展示风格", "Gallery Style"), exact: true });
    if (await page.evaluate(() => CSS.supports("appearance", "base-select"))) {
      await stylePicker.click(); await expect.poll(() => stylePicker.evaluate(element => element.matches(":open"))).toBe(true);
      await page.keyboard.press("Escape"); await expect.poll(() => stylePicker.evaluate(element => element.matches(":open"))).toBe(false);
      await expect(viewer.locator(".immersive-settings")).toBeVisible();
    }
    await page.keyboard.press("Escape"); await expect(viewer.locator(".immersive-settings")).toBeHidden();
    await page.keyboard.press("Escape"); await expect.poll(() => page.evaluate(() => Boolean(document.fullscreenElement))).toBe(false); await expect(viewer).toBeVisible();
    await expect.poll(() => desktop.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isFullScreen())).toBe(false);
    await viewer.getByRole("button", { name: l("播放", "Play"), exact: true }).click(); await expect(stage).toHaveAttribute("data-playing", "true");
    // Inject the blur event in the actual Electron renderer. Acceptance windows
    // stay hidden, so this does not claim to reproduce OS foreground switching.
    await page.evaluate(() => window.dispatchEvent(new Event("blur"))); await expect(stage).toHaveAttribute("data-playing", "false");
    await page.keyboard.press("+"); await expect(viewer.getByRole("button", { name: l("重置缩放", "Reset zoom"), exact: true })).toHaveText("125%");
    await page.keyboard.press("Escape"); await expect(viewer).toHaveCount(0); assert.equal(page.url(), savedUrl);
    const downloadPath = path.join(userData, "recap.png");
    await desktop.evaluate(({ BrowserWindow }, destination) => {
      globalThis.collectionDownloadState = "waiting";
      BrowserWindow.getAllWindows()[0].webContents.session.once("will-download", (_event, item) => {
        item.setSavePath(destination);
        globalThis.collectionDownloadState = "started";
        item.once("done", (_doneEvent, state) => { globalThis.collectionDownloadState = state; });
      });
    }, downloadPath);
    await page.getByRole("button", { name: l("生成长图", "Generate Image"), exact: true }).click();
    await expect.poll(() => desktop.evaluate(() => globalThis.collectionDownloadState), { timeout: 30000 }).toBe("completed");
    assert.equal(fs.readFileSync(downloadPath).subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
    await desktop.close(); desktop = null;
    const reopened = await launch(); await reopened.goto(new URL(reopened.url()).origin + new URL(savedUrl).pathname + new URL(savedUrl).search); await expect(reopened.getByLabel(l("回顾标题", "Recap Title"), { exact: true })).toHaveValue(l("2026年1月收藏回顾", "January 2026 Collection Recap"));
    console.log(`Collection desktop passed (${locale}): live filters, HTML/native fullscreen, Escape, pause, zoom, return and PNG download.`);
  } finally { if (desktop) await desktop.close(); }
}
(async () => { try { for (const locale of ["zh-CN", "en"]) await run(locale); } finally { fs.rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 }); } })().catch(error => { console.error(error); process.exitCode = 1; });
