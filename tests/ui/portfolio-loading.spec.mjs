import { expect, test } from "@playwright/test";

for (const locale of ["zh", "en"]) {
  test(`slow navigation keeps the current page and delays its navigation hint (${locale})`, async ({ page, context }, testInfo) => {
    if (locale === "en") await context.addCookies([{ name: "card_vault_ui_locale", value: "en", url: "http://127.0.0.1:3360" }]);
    await page.goto("/", { waitUntil: "networkidle" });
    await expect(page.locator(".collection-summary")).toBeVisible();
    await page.clock.install();
    await page.clock.pauseAt(new Date());
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    await page.route(/\/portfolio(?:\?|$)/, async route => {
      await gate;
      await route.continue();
    });
    try {
      await page.locator('.nav-links a[href="/portfolio"]').click();
      await page.clock.runFor(399);
      await expect(page.locator(".navigation-pending")).toHaveCount(0);
      await expect(page.locator(".collection-summary")).toBeVisible();
      await page.clock.runFor(1);
      await expect(page.locator('.nav-links a[href="/portfolio"]').getByRole("status")).toBeVisible();
      await expect(page.locator(".collection-summary")).toBeVisible();
      await expect(page.getByTestId("portfolio-loading")).toHaveCount(0);
      await expect(page.getByTestId("page-loading")).toHaveCount(0);
      await page.screenshot({ path: testInfo.outputPath(`navigation-${locale}.png`) });
    } finally {
      release();
      await page.clock.resume();
    }
    await expect(page.locator(".portfolio-page")).toBeVisible();
    await expect(page.locator(".navigation-pending")).toHaveCount(0);
  });
}
