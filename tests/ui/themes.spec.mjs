import { expect, test } from "@playwright/test";

const cookieName = "card_vault_app_theme";
const themes = [["gallery", "极简展厅"], ["midnight", "午夜典藏"], ["archive", "暖纸档案"]];

test("application themes recover unknown values without default or reset controls", async ({ page, context }) => {
  await page.goto("/settings#theme-settings", { waitUntil: "networkidle" });
  await expect(page.locator("html")).toHaveAttribute("data-app-theme", "classic");
  await expect(page.getByRole("radio", { name: /经典/ })).toBeChecked();
  await expect(page.locator("#theme-settings")).toHaveText("主题应用主题经典极简展厅午夜典藏暖纸档案");
  await expect(page.getByRole("button", { name: "恢复经典" })).toHaveCount(0);
  await context.addCookies([{ name: cookieName, value: "removed-theme", url: "http://127.0.0.1:3360" }]);
  const response = await page.reload({ waitUntil: "networkidle" });
  expect(await response.text()).toContain('data-app-theme="classic"');
  await expect(page.getByRole("radio", { name: /经典/ })).toBeChecked();
});

for (const [id, name] of themes) {
  test(`${id} theme applies, persists in initial HTML and allows choosing Classic`, async ({ page, context, browser }) => {
    await page.goto("/settings#theme-settings", { waitUntil: "networkidle" });
    const fontBefore = await page.locator("body").evaluate(element => getComputedStyle(element).fontFamily);
    await page.getByRole("radio", { name: new RegExp(name) }).check();
    await expect(page.locator("html")).toHaveAttribute("data-app-theme", id);
    const stored = (await context.cookies()).find(cookie => cookie.name === cookieName);
    expect(stored.value).toBe(id);
    expect(stored.expires).toBeGreaterThan(Date.now() / 1000 + 300 * 86400);
    expect(await page.locator("body").evaluate(element => getComputedStyle(element).fontFamily)).toBe(fontBefore);
    await expect(page).toHaveScreenshot(`theme-${id}-settings.png`, { fullPage: true });
    await page.getByRole("link", { name: "首页", exact: true }).click();
    await expect(page).toHaveURL("/");
    await expect(page.locator(".home-page .summary-grid")).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("data-app-theme", id);
    await page.reload({ waitUntil: "networkidle" });
    await expect(page).toHaveScreenshot(`theme-${id}-home.png`, { fullPage: true });

    // A fresh browser context with persisted cookies must render the theme before hydration.
    const restarted = await browser.newContext({ storageState: await context.storageState(), javaScriptEnabled: false });
    try {
      const coldPage = await restarted.newPage();
      const response = await coldPage.goto("http://127.0.0.1:3360/", { waitUntil: "networkidle" });
      expect(await response.text()).toContain(`data-app-theme="${id}"`);
      await expect(coldPage.locator("html")).toHaveCSS("--theme-background", `url("/app-themes/${id}.webp")`);
      await expect(coldPage.locator("body")).toHaveCSS("color", id === "midnight" ? "rgb(237, 241, 245)" : id === "archive" ? "rgb(57, 47, 39)" : "rgb(25, 46, 52)");
    } finally { await restarted.close(); }

    await page.goto("/settings#theme-settings", { waitUntil: "networkidle" });
    await page.getByRole("radio", { name: "经典", exact: true }).check();
    await expect(page.locator("html")).toHaveAttribute("data-app-theme", "classic");
    await expect(page.locator("html")).not.toHaveAttribute("style", /--theme-/);
    await page.reload({ waitUntil: "networkidle" });
    await expect(page.getByRole("radio", { name: /经典/ })).toBeChecked();
  });
}

test("theme choices support keyboard navigation and the minimum window", async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 760 });
  await page.goto("/settings#theme-settings", { waitUntil: "networkidle" });
  const classic = page.getByRole("radio", { name: /经典/ });
  await classic.focus();
  await classic.press("ArrowRight");
  await expect(page.getByRole("radio", { name: /极简展厅/ })).toBeChecked();
  await expect(page.locator("html")).toHaveAttribute("data-app-theme", "gallery");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("midnight keeps editing, finance, charts and share designs readable and independent", async ({ page, context }, testInfo) => {
  await page.goto("/shares/ui-share-1/preview", { waitUntil: "networkidle" });
  const frame = page.locator("iframe").first();
  const beforePreview = await frame.getAttribute("srcdoc");
  expect(beforePreview).toBeTruthy();
  await context.addCookies([{ name: cookieName, value: "midnight", url: "http://127.0.0.1:3360" }]);
  await page.reload({ waitUntil: "networkidle" });
  expect(await frame.getAttribute("srcdoc")).toBe(beforePreview);

  for (const [name, path, ready] of [
    ["showcase", "/showcase", ".showcase-grid"],
    ["portfolio", "/portfolio", ".portfolio-page"],
    ["edit", "/cards/ui-card-1/edit", "form.panel"],
    ["finance", "/cards/ui-card-1", "#financial-history"],
    ["entry", "/cards/new", ".entry-workbench-layout"],
    ["share-editor", "/shares/ui-share-1/edit", ".shares-page"],
    ["plans", "/collection", ".plans-page"],
    ["data", "/settings/data", ".management-card-list"]
  ]) {
    await page.goto(path, { waitUntil: "networkidle" });
    await expect(page.locator(ready)).toBeVisible();
    if (name === "share-editor") {
      await expect(page.locator(".share-wizard-step").nth(1)).toHaveCSS("background-color", "rgb(29, 48, 66)");
      await page.getByRole("button", { name: /内容修改/ }).click();
      await page.getByRole("button", { name: /视觉设计/ }).click();
      await expect(page.locator(".share-design-workspace")).toBeVisible();
    }
    if (name === "finance") {
      await page.getByRole("button", { name: "＋ 新增记录", exact: true }).click();
      await expect(page.locator("#financial-add-record")).toBeVisible();
      await expect(page.getByRole("tab", { name: "交易", exact: true })).toHaveCSS("color", "rgb(21, 32, 44)");
    }
    await expect(page.locator("body")).toHaveCSS("color", "rgb(237, 241, 245)");
    const control = page.locator('input:not([type=checkbox]):not([type=radio]):not([type=hidden]), textarea').filter({ visible: true }).first();
    if (await control.count()) {
      await expect(control).toHaveCSS("background-color", /^rgba?\(21, 35, 50(?:, 0\.\d+)?\)$/);
      await expect(control).toHaveCSS("color", "rgb(237, 241, 245)");
    }
    await testInfo.attach(`midnight-${name}`, { body: await page.screenshot({ fullPage: true, animations: "disabled" }), contentType: "image/png" });
  }
  await page.route("**/api/ai/portfolio-analysis", route => route.fulfill({ status: 503, json: { error: "Theme preview: offline" } }));
  await page.goto("/portfolio", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "组合分析", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCSS("background-image", /rgb\(29, 48, 66\)/);
  await expect(page.getByRole("dialog").getByText("Theme preview: offline")).toBeVisible();
  await testInfo.attach("midnight-analysis-dialog", { body: await page.screenshot({ animations: "disabled" }), contentType: "image/png" });
  await page.getByRole("button", { name: "关闭组合分析" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
