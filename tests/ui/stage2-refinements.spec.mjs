import { withUiDatabase as fixture } from './database-fixture.mjs';
import { expect, test } from "@playwright/test";
test.afterEach(() => fixture(db => db.exec("DELETE FROM Card WHERE id LIKE 'refine-%'")));

test("one financial table preserves partial sales while switching status and returning from details", async ({ page }) => {
  fixture(db => {
    const insert = db.prepare("INSERT INTO Card(id,playerName,cardTitle,sport,collectionStatus,holdingQuantity) VALUES(?,'Refine details',?,'Basketball',?,?)");
    insert.run("refine-held", "Held archive", "holding", 2);
    insert.run("refine-partial", "Partial sale archive", "holding", 1);
    insert.run("refine-closed", "Closed archive", "sold", 0);
    const transaction = db.prepare("INSERT INTO CardTransaction(id,cardId,kind,quantity,amountMinor,currency,occurredAt,provenance) VALUES(?,?,?,?,?,'CNY','2026-08-01T00:00:00.000Z','ui-test')");
    for (const id of ["refine-held", "refine-partial", "refine-closed"]) transaction.run(id + "-buy", id, "purchase", 2, 10000);
    transaction.run("refine-partial-sale", "refine-partial", "sale", 1, 7500);
    transaction.run("refine-closed-sale", "refine-closed", "sale", 2, 15000);
  });
  await page.goto("/portfolio?tab=details&q=Refine+details", { waitUntil: "networkidle" });
  const details = page.getByTestId("data-details"), rows = details.locator("tbody tr");
  const headings = await details.locator("thead th").allTextContents();
  await expect(rows).toHaveCount(3);
  const status = page.getByRole("combobox", { name: "明细状态", exact: true });
  const apply = () => details.getByRole("button", { name: "筛选", exact: true }).click();
  await status.selectOption("sales"); await apply();
  await expect(rows).toHaveCount(2);
  const partial = rows.filter({ hasText: "Partial sale archive" });
  await expect(partial).toContainText(/持有数量\s*1/);
  await expect(partial).toContainText(/出售数量\s*1/);
  await expect(partial).toContainText("已实现盈亏");
  await expect(partial).toContainText("+25.00");
  expect(await details.locator("thead th").allTextContents()).toEqual(headings);
  await partial.getByRole("link").click();
  await page.getByRole("link", { name: "返回上一页", exact: true }).click();
  await expect(status).toHaveValue("sales");
  await expect(rows).toHaveCount(2);
  await status.selectOption("sold"); await apply();
  await expect(rows).toHaveCount(1);
  await expect(rows).toContainText(["Closed archive"]);
  await status.selectOption("holdings"); await apply();
  await expect(rows).toHaveCount(2);
  await status.selectOption("all"); await apply();
  await expect(rows).toHaveCount(3);
});

test("share creation uses the entry title size and saves drafts without a success notice", async ({ page }) => {
  await page.goto("/cards/new", { waitUntil: "networkidle" });
  const entryFont = await page.getByRole("heading", { name: "新增卡片", exact: true }).evaluate(element => getComputedStyle(element).fontSize);
  await page.goto("/shares/new", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "新建分享集", exact: true })).toHaveCSS("font-size", entryFont);
  const group = page.locator(".share-sport-group").first();
  if (await group.getAttribute("open") === null) await group.locator(":scope > summary").click();
  await page.locator('.share-card-option input[type="checkbox"]').first().check();
  await page.getByRole("button", { name: /预览并保存/ }).click();
  const ai = page.locator(".share-ai-assistance > summary");
  await expect(ai).toBeVisible();
  expect((await ai.boundingBox()).height).toBeGreaterThanOrEqual(44);
  expect((await ai.boundingBox()).width).toBeGreaterThanOrEqual(180);
  await page.locator('input[name="title"]').fill("Refine locally saved share");
  await page.waitForFunction(() => Object.keys(localStorage).some(key => key.startsWith("card-vault:share-editor:") && localStorage.getItem(key)?.includes("Refine locally saved share")));
  await expect(page.getByText("草稿已自动保存到本机", { exact: true })).toHaveCount(0);
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.getByRole("button", { name: "恢复草稿", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "恢复草稿", exact: true }).click();
  await page.getByRole("button", { name: /预览并保存/ }).click();
  await expect(page.locator('input[name="title"]')).toHaveValue("Refine locally saved share");
});

test("header utility buttons match in all themes and the Showcase sharing entry has no arrow", async ({ page, context }) => {
  test.setTimeout(120000);
  for (const theme of ["classic", "gallery", "midnight", "archive"]) {
    await context.addCookies([{ name: "card_vault_app_theme", value: theme, url: "http://127.0.0.1:3360" }]);
    for (const width of [1100, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/showcase", { waitUntil: "networkidle" });
      const styles = await page.locator(".header-tool").evaluateAll(elements => elements.map(element => {
        const style = getComputedStyle(element), box = element.getBoundingClientRect();
        return { width: box.width, height: box.height, y: box.y, border: style.border, radius: style.borderRadius, background: style.backgroundColor, color: style.color };
      }));
      expect(styles).toHaveLength(2); expect(styles[0]).toEqual(styles[1]);
      await expect(page.locator(".showcase-shares")).toHaveText("分享集");
      expect((await page.locator(".showcase-shares").boundingBox()).height).toBeGreaterThanOrEqual(36);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
  }
});
