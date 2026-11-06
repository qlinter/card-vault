const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { _electron: electron, expect } = require("@playwright/test");
const { initializeDatabase } = require("./database-schema");
const { createAiConfigManager } = require("../electron/ai-config");

const projectRoot = path.resolve(__dirname, "..");
const development = process.argv.includes("--development");
const executable = development ? require("electron") : path.resolve(process.argv[2] || "dist/win-unpacked/Card Vault.exe");
const root = fs.mkdtempSync(path.join(os.tmpdir(), "card-vault-ai-delete-"));
const resolvedRoot = path.resolve(root);
assert.equal(path.dirname(resolvedRoot), path.resolve(os.tmpdir()));
assert.ok(path.basename(resolvedRoot).startsWith("card-vault-ai-delete-"));

async function run(locale) {
  const userData = path.join(root, locale);
  const configPath = path.join(userData, "ai-config.json");
  initializeDatabase(path.join(userData, "data", "dev.db"));
  createAiConfigManager(configPath).save({ provider: "custom", activeCustomId: "a", proxy: { mode: "direct" }, customProviders: ["a", "b"].map(id => ({
    id, name: `Fixture ${id}`, endpoint: "http://127.0.0.1:1/fixture/chat/completions", model: id
  })) });
  const env = { ...process.env, CARD_VAULT_USER_DATA_DIR: userData, CARD_VAULT_ACCEPTANCE_MODE: "1" };
  delete env.ELECTRON_RUN_AS_NODE;
  let desktop;
  const launch = async () => {
    const logPath = path.join(userData, "logs", "desktop.log");
    const offset = fs.existsSync(logPath) ? fs.readFileSync(logPath, "utf8").length : 0;
    const app = await electron.launch({ executablePath: executable, args: development ? [projectRoot] : [], env, timeout: 60000 });
    desktop = app;
    await expect.poll(() => fs.existsSync(logPath) && fs.readFileSync(logPath, "utf8").slice(offset).includes("Desktop app boot completed."), { timeout: 60000 }).toBe(true);
    const page = await app.firstWindow();
    await page.waitForLoadState("networkidle");
    const origin = new URL(page.url()).origin;
    await page.context().addCookies([{ name: "card_vault_ui_locale", value: locale, url: origin }]);
    await page.goto(origin + "/settings", { waitUntil: "networkidle" });
    await page.locator(".ai-settings-panel > button").click();
    return page;
  };
  const l = (zh, en) => locale === "en" ? en : zh;
  try {
    const page = await launch();
    let nativeDialogs = 0;
    page.on("dialog", async dialog => { nativeDialogs++; await dialog.dismiss(); });
    const service = page.getByRole("combobox", { name: l("当前服务", "Current Service"), exact: true });
    const remove = page.getByRole("button", { name: l("删除当前配置", "Delete Current Configuration"), exact: true });
    const confirmation = page.getByRole("group", { name: l("删除自定义配置确认", "Confirm Custom Configuration Deletion"), exact: true });
    const cancel = confirmation.getByRole("button", { name: l("取消", "Cancel"), exact: true });
    const confirm = confirmation.getByRole("button", { name: l("确认删除", "Confirm Deletion"), exact: true });
    await expect(service).toHaveValue("custom:a");
    await remove.click();
    await expect(confirmation).toBeVisible();
    await expect(cancel).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(confirmation).toHaveCount(0);
    await expect(remove).toBeFocused();
    await remove.click(); await cancel.click();
    await expect(service).toHaveValue("custom:a");
    await remove.click(); await service.selectOption("custom:b");
    await expect(confirmation).toHaveCount(0);
    await remove.click(); await confirm.click();
    await expect(service).toHaveValue("custom:a");
    await expect(service).toBeFocused();
    const customModel = page.getByLabel("Model *", { exact: true });
    await customModel.click(); await customModel.press("End"); await customModel.pressSequentially("-editable");
    await expect(customModel).toHaveValue("a-editable");
    await remove.click(); await confirm.click();
    await expect(service).toHaveValue("openai");
    await expect(service).toBeFocused();
    const model = page.getByLabel("Model", { exact: true });
    await model.click(); await model.press("ControlOrMeta+A"); await model.pressSequentially("fixture-openai");
    await expect(model).toHaveValue("fixture-openai");
    await page.getByLabel("Endpoint", { exact: true }).fill("http://127.0.0.1:1/fixture/chat/completions");
    const key = page.getByLabel("API Key", { exact: true });
    await key.pressSequentially("fixture-key");
    await page.route("**/api/ai/models", route => route.fulfill({ json: { models: ["fixture-option"] } }));
    await page.route("**/api/ai/test-settings", route => route.fulfill({ json: { ok: true, capability: "text", route: { source: "direct", connection: "direct", attempt: 1 } } }));
    await page.getByRole("button", { name: l("读取模型", "Load Models"), exact: true }).click();
    await page.getByRole("combobox", { name: l("选择模型", "Select Model"), exact: true }).selectOption("fixture-option");
    await page.getByRole("button", { name: l("测试连接", "Test Connection"), exact: true }).click();
    await expect(page.locator(".ai-capability-result")).toBeVisible();
    await key.fill(""); // Exercise IPC persistence without depending on device encryption.
    await page.locator(".ai-proxy-settings > summary").click();
    await page.getByRole("combobox", { name: l("连接方式", "Connection mode"), exact: true }).selectOption("auto");
    await page.getByRole("combobox", { name: l("连接方式", "Connection mode"), exact: true }).selectOption("direct");
    await service.selectOption("deepseek");
    await page.getByLabel("Model", { exact: true }).fill("fixture-deepseek");
    await page.getByRole("button", { name: l("保存设置", "Save Settings"), exact: true }).click();
    await expect(page.locator(".ai-settings-panel [role=status]")).toHaveText(l("AI 设置已保存。", "AI settings saved."), { timeout: 45000 });
    await expect(service).toBeEnabled();
    const saved = await page.evaluate(() => window.cardVaultDesktop.getAiSettings());
    assert.equal(saved.provider, "deepseek"); assert.deepEqual(saved.customProviders, []);
    const input = page.getByLabel("Model", { exact: true });
    await input.click(); await input.press("End"); await input.pressSequentially("-after-save");
    await expect(input).toHaveValue("fixture-deepseek-after-save");
    assert.equal(nativeDialogs, 0, "AI deletion must never open a native JavaScript dialog");
    await desktop.close(); desktop = null;
    const reopened = await launch();
    await expect(reopened.getByRole("combobox", { name: l("当前服务", "Current Service"), exact: true })).toHaveValue("deepseek");
    await expect(reopened.locator('.ai-provider-picker option[value^="custom:"]')).toHaveCount(0);
    await expect(reopened.getByLabel("Model", { exact: true })).toHaveValue("fixture-deepseek");
    await reopened.getByRole("button", { name: l("新增自定义 AI", "Add Custom AI"), exact: true }).click();
    const name = reopened.getByLabel(l("显示名称 *", "Display Name *"), { exact: true });
    await name.click(); await name.press("ControlOrMeta+A"); await name.pressSequentially("New editable fixture");
    await expect(name).toHaveValue("New editable fixture");
    console.log(`AI deletion desktop passed (${locale}): cancel, Escape, stale confirmation, repeated and last deletion, typing, selectors, mocked requests, real IPC save and persistence.`);
  } finally { if (desktop) await desktop.close(); }
}

(async () => {
  try { for (const locale of ["zh", "en"]) await run(locale); }
  finally {
    fs.rmSync(resolvedRoot, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
