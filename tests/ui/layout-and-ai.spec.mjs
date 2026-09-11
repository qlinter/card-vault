import { expect, test } from "@playwright/test";
import { DatabaseSync } from "node:sqlite";
import path from "node:path";

function fixture(action) {
  const db = new DatabaseSync(path.resolve("tests/.ui-test-runtime/data/dev.db"));
  try { db.exec("PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000"); action(db); } finally { db.close(); }
}

test.afterEach(() => fixture(db => db.exec("DELETE FROM Card WHERE id='layout-long-product';")));

test("financial history keeps amounts and edit actions aligned when an editor opens", async ({ page }) => {
  await page.goto("/cards/ui-card-1", { waitUntil: "networkidle" });
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
  const holdings = page.locator("section").filter({ has: page.getByRole("heading", { name: "持仓", exact: true }) }).last();
  const metrics = await holdings.locator("dl > div").evaluateAll(elements => elements.map(element => {
    const label = element.querySelector("dt").getBoundingClientRect();
    const amount = element.querySelector("dd").getBoundingClientRect();
    return { labelBottom: label.bottom, amountBottom: amount.bottom, gap: amount.left - label.right };
  }));
  expect(metrics).toHaveLength(9);
  for (const metric of metrics) expect(metric.gap).toBeGreaterThan(0);
  await page.getByLabel("收藏结构维度").selectOption("extended");
  const product = page.locator("article").filter({ has: page.getByRole("heading", { name: "产品线", exact: true }) });
  await expect(product).toBeVisible();
  await expect(product.getByRole("link", { name: longProduct, exact: true })).toBeVisible();
  const footer = await product.locator("footer > div").evaluateAll(elements => elements.map(element => ({
    label: element.querySelector("span").getBoundingClientRect().top,
    value: element.querySelector("strong").getBoundingClientRect().top
  })));
  expect(new Set(footer.map(item => item.label)).size).toBe(1);
  expect(new Set(footer.map(item => item.value)).size).toBe(1);
  const widths = await product.locator("a").evaluateAll(elements => elements.map(element => ({ client: element.clientWidth, scroll: element.scrollWidth })));
  for (const width of widths) expect(width.scroll).toBeLessThanOrEqual(width.client + 1);
  await expect(product).not.toContainText("结构分布");
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
  await expect(page.getByLabel("DeepSeek Endpoint")).toHaveValue("https://api.deepseek.com/chat/completions");
  await expect(page.getByLabel("Model", { exact: true })).toHaveValue("deepseek-flash");
  await page.getByLabel("DeepSeek API Key").fill("mock-key");
  await page.getByRole("button", { name: "测试连接", exact: true }).click();
  await expect(page.getByText("DeepSeek 连接测试通过。", { exact: true })).toBeVisible();
  expect(tested.deepseek.model).toBe("deepseek-flash");
  await page.getByRole("button", { name: "保存设置", exact: true }).click();
  await expect(page.getByLabel("DeepSeek API Key")).toHaveValue("");
  const saved = await page.evaluate(() => window.__savedAiDraft);
  expect(saved.provider).toBe("deepseek");
  expect(saved.azure.endpoint).toBe("https://azure.test");
  expect(saved.azure.apiKey).toBeUndefined();
  expect(saved.minimax.model).toBe("vision");
});
