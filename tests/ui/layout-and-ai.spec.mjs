import { withUiDatabase as fixture } from './database-fixture.mjs';
import { expect, test } from "@playwright/test";

test.afterEach(() => fixture(db => db.exec("DELETE FROM Card WHERE id='layout-long-product';")));

test("financial history keeps amounts and edit actions aligned when an editor opens", async ({ page }) => {
  await page.goto("/cards/ui-card-1", { waitUntil: "networkidle" });
  await page.locator('.financial-history-details > summary').click();
  const rows = page.locator(".financial-timeline-item");
  await expect(rows).toHaveCount(4);
  const amounts = await rows.locator(".financial-record-amount").evaluateAll(elements => elements.map(element => element.getBoundingClientRect().right));
  expect(Math.max(...amounts) - Math.min(...amounts)).toBeLessThan(1);
  const trigger = rows.first().locator(".financial-edit-trigger");
  const before = await trigger.evaluate(element => ({ x: element.getBoundingClientRect().left, y: element.getBoundingClientRect().top + window.scrollY }));
  await trigger.click();
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  await expect(rows.first().locator(".financial-correction-body")).toBeVisible();
  const after = await trigger.evaluate(element => ({ x: element.getBoundingClientRect().left, y: element.getBoundingClientRect().top + window.scrollY }));
  expect(Math.abs(before.x - after.x)).toBeLessThan(1);
  expect(Math.abs(before.y - after.y)).toBeLessThan(1);
  await trigger.click();
  await expect(rows.first().locator(".financial-correction-body")).toBeHidden();
});

test("portfolio metrics, concentration and long product lines stay inside their columns", async ({ page }) => {
  const longProduct = "Championship International Limited Edition Autographed Memorabilia Collection 2026";
  fixture(db => db.prepare("INSERT INTO Card(id, playerName, cardTitle, sport, productLine) VALUES('layout-long-product','Layout Fixture','Long product line','Basketball',?)").run(longProduct));
  await page.goto("/portfolio", { waitUntil: "networkidle" });
  const metrics = page.locator('[aria-label="financial summary"] article strong');
  await expect(metrics).toHaveCount(4);
  const tops = await metrics.evaluateAll(elements => elements.map(element => element.getBoundingClientRect().top));
  expect(Math.max(...tops) - Math.min(...tops)).toBeLessThan(1);
  await page.getByRole("link", { name: "结构", exact: true }).click();
  await page.getByLabel("收藏结构维度").selectOption("productLine");
  await page.getByRole("button", { name: "应用", exact: true }).click();
  await expect(page.getByRole("link", { name: longProduct, exact: true })).toBeVisible();
  const bounds = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
  expect(bounds.scroll).toBeLessThanOrEqual(bounds.width + 1);
});

test("DeepSeek settings select, test and save the official defaults without clearing other providers", async ({ page }) => {
  await page.addInitScript(() => {
    window.cardVaultDesktop = {
      getAiSettings: async () => ({
        provider: "azure", activeCustomId: "", customProviders: [],
        azure: { endpoint: "https://azure.test", deployment: "vision", hasApiKey: true },
        minimax: { endpoint: "https://minimax.test", model: "vision", hasApiKey: true }
      }),
      saveAiSettings: async draft => {
        window.__savedAiDraft = draft;
        return { ...draft, deepseek: { ...draft.deepseek, apiKey: undefined, hasApiKey: true } };
      }
    };
  });
  let tested;
  await page.route("**/api/ai/test-settings", async route => {
    tested = route.request().postDataJSON();
    await route.fulfill({ json: { ok: true } });
  });
  await page.goto("/settings", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "展开 AI" }).click();
  await page.getByRole("combobox", { name: "当前服务", exact: true }).selectOption("deepseek");
  await expect(page.getByLabel("Endpoint", { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '新增自定义 AI', exact: true })).toBeVisible();
  await expect(page.getByLabel("Endpoint", { exact: true })).toHaveValue("https://api.deepseek.com/chat/completions");
  await expect(page.getByLabel("Model", { exact: true })).toHaveValue("deepseek-flash");
  await page.getByLabel("API Key", { exact: true }).fill("mock-key");
  await page.getByRole("button", { name: "测试连接", exact: true }).click();
  await expect(page.getByText("DeepSeek 连接测试通过。", { exact: true })).toBeVisible();
  expect(tested.deepseek.model).toBe("deepseek-flash");
  await page.getByRole("button", { name: "保存设置", exact: true }).click();
  await expect(page.getByLabel("API Key", { exact: true })).toHaveValue("");
  const saved = await page.evaluate(() => window.__savedAiDraft);
  expect(saved.provider).toBe("deepseek");
  expect(saved.azure.endpoint).toBe("https://azure.test");
  expect(saved.azure.apiKey).toBeUndefined();
  expect(saved.minimax.model).toBe("vision");
});
