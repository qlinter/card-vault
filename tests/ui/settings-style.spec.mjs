import { withUiDatabase as fixture } from './database-fixture.mjs';
import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const longName = "Local compatible vision provider with an extended descriptive name";
const longModel = "organization/collection-vision-instruct-2026-extended-context";
const longPath = "D:\\CardVault\\Collection archive and backup directory\\" + "long-folder-name-".repeat(9);
const rateSource = "Reference exchange rate for collection valuation and historical reporting. ".repeat(2);

test.use({ actionTimeout: 10_000 });

test.beforeAll(() => fixture(db => db.prepare("INSERT INTO ExchangeRate(id,effectiveDate,rateMicros,source,revision) VALUES('settings-style-rate','2026-01-03',7000000,?,1)").run(rateSource)));
test.afterAll(() => fixture(db => db.exec("DELETE FROM ExchangeRate WHERE id='settings-style-rate'")));

async function mockDesktop(page, emptyBackup = false) {
  await page.addInitScript(({ longName, longModel, longPath, emptyBackup }) => {
    window.cardVaultDesktop = {
      onStorageProgress: () => () => {},
      getBackupSettings: async () => ({ path: longPath, ...(emptyBackup ? { automatic: { enabled: true, keep: 20 } } : {}), lastBackup: emptyBackup ? null : { createdAt: "2026-01-01T00:00:00Z", bytes: 123456789, imageCount: 1234, available: true } }),
      checkDataHealth: async () => ({ ok: true, integrity: "ok", counts: { cards: 3, images: 6, queueItems: 0, shares: 1 }, missingFiles: [], issues: [], orphanFiles: [{ type: "shareBackground", path: longPath + "background-image.jpg" }] }),
      getAiSettings: async () => ({
        provider: "openai", activeCustomId: "style-provider",
        openai: { endpoint: "https://openai.example.test/extended/model/endpoint", model: longModel, hasApiKey: true },
        minimax: { endpoint: "https://api.minimax.io/v1/chat/completions", model: "MiniMax-VL-01", hasApiKey: true },
        deepseek: { endpoint: "https://api.deepseek.com/chat/completions", model: "deepseek-flash", hasApiKey: true },
        customProviders: [{ id: "style-provider", name: longName, endpoint: "https://local.example.test/v1/chat/completions", modelsEndpoint: "https://local.example.test/v1/models", model: longModel, hasApiKey: true }]
      })
    };
  }, { longName, longModel, longPath, emptyBackup });
  await page.route("**/api/ai/models", route => route.fulfill({ json: { models: [longModel, "compact-vision"] } }));
}

async function loadMapping(page) {
  const toggle = page.locator('#data-transfer > button');
  if (await toggle.getAttribute('aria-expanded') !== 'true') await toggle.click();
  await page.locator('input[type="file"]').setInputFiles({
    name: "settings-layout.csv", mimeType: "text/csv",
    buffer: Buffer.from("playerName,Long external spreadsheet column for collection display notes,cardTitle,grade\nLayout Player,A long preview value with enough detail to wrap naturally across several lines,Collection Card,10\n")
  });
  await expect(page.locator(".import-mapping-grid > label")).toHaveCount(4);
}

async function expectContained(page) {
  const overflow = await page.locator(".settings-surface").evaluate(root => {
    const problems = [];
    for (const element of root.querySelectorAll(".panel, .form-grid, .mapping-grid, input, select, textarea, .btn")) {
      if (!element.checkVisibility()) continue;
      const rect = element.getBoundingClientRect();
      const panel = element.closest(".panel")?.getBoundingClientRect();
      if (rect.width > 0 && (rect.left < -1 || rect.right > document.documentElement.clientWidth + 1 || panel && (rect.left < panel.left - 1 || rect.right > panel.right + 1))) problems.push(`${element.className || element.tagName}: outside panel`);
      if (element.matches(".panel, .form-grid, .mapping-grid, .btn") && element.scrollWidth > element.clientWidth + 1) problems.push(`${element.className}: clipped content`);
    }
    if (document.documentElement.scrollWidth > document.documentElement.clientWidth + 1) problems.push("page overflow");
    return problems;
  });
  expect(overflow).toEqual([]);
}

async function expectUniformButtons(page) {
  await page.mouse.move(0, 0);
  await expect.poll(() => page.locator(".settings-surface .btn").evaluateAll(buttons => [...new Set(buttons.filter(button => button.checkVisibility()).map(button => {
    const style = getComputedStyle(button);
    return JSON.stringify([style.backgroundColor, style.color, style.borderColor, style.boxShadow]);
  }))])).toHaveLength(1);
}

test("backup shows its empty state and import selections retain their state", async ({ page }) => {
  await mockDesktop(page, true);
  await page.setViewportSize({ width: 1100, height: 760 });
  await page.goto("/settings#data-settings", { waitUntil: "networkidle" });
  const backup = page.locator(".backup-settings");
  await expect(backup.getByRole("button")).toHaveText(["设置备份路径", "一键备份", "备份恢复"]);
  const buttonColors = await backup.getByRole("button").evaluateAll(buttons => buttons.map(button => { const style = getComputedStyle(button); return [style.backgroundColor, style.color, style.borderColor]; }));
  expect(buttonColors[1]).toEqual(buttonColors[0]);
  expect(buttonColors[2]).toEqual(buttonColors[0]);
  await expect(backup.locator("input, select")).toHaveCount(0);
  await expect(backup.getByRole("status")).toHaveText("当前收藏库尚无成功备份记录。");
  await expect(backup).not.toContainText("自动备份");
  await loadMapping(page);
  const mapping = page.locator(".import-mapping-grid select");
  await mapping.nth(1).selectOption("publicDescription");
  await expect(mapping.nth(1)).toHaveAttribute("title", /展示描述/);
  await page.locator("#data-settings > button").click();
  await page.locator("#data-settings > button").click();
  await expect(mapping.nth(1)).toHaveValue("publicDescription");
  await expectContained(page);
});

test("expanded settings fit all themes, both languages and desktop window sizes", async ({ page, context }) => {
  test.setTimeout(180_000);
  await mockDesktop(page);
  const screenshots = path.resolve("logs/settings-style");
  fs.mkdirSync(screenshots, { recursive: true });
  for (const locale of ["zh", "en"]) for (const theme of ["classic", "gallery", "midnight", "archive"]) for (const width of [1100, 1440]) {
    await context.addCookies([
      { name: "card_vault_app_theme", value: theme, url: "http://127.0.0.1:3360" },
      { name: "card_vault_ui_locale", value: locale, url: "http://127.0.0.1:3360" }
    ]);
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/settings", { waitUntil: "networkidle" });
    for (const id of ["theme-settings", "data-settings", "financial-settings", "data-maintenance"]) await page.locator(`#${id} > button`).click();
    await page.locator(".ai-settings-panel > button").click();
    await page.locator(".settings-help-toggle").click();
    await page.locator(".settings-help-actions button").click();
    await page.getByRole("button", { name: /^(检查数据健康|Check Data Health)$/ }).click();
    await page.locator(".orphan-cleanup-panel summary").click();
    await loadMapping(page);
    if (locale === "en") {
      await expect(page.locator(".health-result")).not.toContainText(/[\u3400-\u9fff]/u);
      await expect(page.locator(".orphan-file-list button")).toHaveText("Show in Folder");
    }
    await page.locator(".exchange-rate-history > summary").click();
    const rate = page.locator(".exchange-rate-row").filter({ hasText: rateSource });
    await rate.getByRole("button", { name: /^(编辑|Edit)$/ }).click();
    await expect(rate.locator('[name="source"]')).toHaveValue(rateSource);
    const provider = page.locator(".ai-provider-picker select");
    for (const value of ["minimax", "deepseek", "custom:style-provider", "openai"]) {
      await provider.selectOption(value);
      await expectContained(page);
    }
    await provider.selectOption("custom:style-provider");
    await page.getByRole("button", { name: /^(读取模型|Load Models)$/ }).click();
    const model = page.getByRole("combobox", { name: /^(选择模型|Select Model)$/ });
    await expect(model).toHaveValue(longModel);
    await model.selectOption("compact-vision");
    await expect(page.getByLabel("Model *", { exact: true })).toHaveValue("compact-vision");
    await expectContained(page);
    await expectUniformButtons(page);
    if (theme === "classic" && (locale === "zh" || width === 1100) || theme === "midnight" && locale === "zh" && width === 1100) {
      for (const [name, selector] of [["theme", "#theme-settings"], ["data", "#data-settings"], ["ai", ".ai-settings-panel"], ["finance", "#financial-settings"], ["help", ".settings-help"]]) await page.locator(selector).screenshot({ path: path.join(screenshots, `${name}-${theme}-${locale}-${width}.png`), animations: "disabled" });
    }
    await rate.getByRole("button", { name: /^(关闭编辑|Close editor)$/ }).click();
    await expect(rate.locator(".exchange-rate-form")).toHaveCount(0);
  }
});
