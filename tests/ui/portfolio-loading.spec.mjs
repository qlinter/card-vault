import { expect, test } from "@playwright/test";
import { DatabaseSync } from "node:sqlite";
import path from "node:path";

const databasePath = path.resolve("tests/.ui-test-runtime/data/dev.db");
function database() {
  const db = new DatabaseSync(databasePath);
  db.exec("PRAGMA busy_timeout=5000");
  return db;
}

for (const locale of ["zh", "en"]) {
  test(`slow navigation keeps the current page and delays its navigation hint (${locale})`, async ({ page, context }, testInfo) => {
    if (locale === "en") await context.addCookies([{ name: "card_vault_ui_locale", value: "en", url: "http://127.0.0.1:3360" }]);
    await page.goto("/", { waitUntil: "networkidle" });
    await expect(page.locator(".summary-grid")).toBeVisible();
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
      await expect(page.locator(".summary-grid")).toBeVisible();
      await page.clock.runFor(1);
      await expect(page.locator('.nav-links a[href="/portfolio"]').getByRole("status")).toBeVisible();
      await expect(page.locator(".summary-grid")).toBeVisible();
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

  test(`portfolio failure can be retried without losing filters (${locale})`, async ({ page, context }, testInfo) => {
    if (locale === "en") await context.addCookies([{ name: "card_vault_ui_locale", value: "en", url: "http://127.0.0.1:3360" }]);
    const db = database();
    const restore = () => db.prepare("DELETE FROM PortfolioSavedView WHERE id='page-recovery-fixture'").run();
    try {
      db.prepare("INSERT INTO PortfolioSavedView(id,name,queryJson,updatedAt) VALUES('page-recovery-fixture','Recovery fixture','invalid',?)").run(Date.now());
      await page.goto("/portfolio?sport=Basketball&sort=yearAsc");
      await expect(page.getByRole("heading", { name: locale === "en" ? "This page could not be loaded" : "暂时无法加载此页面" })).toBeVisible();
      await page.screenshot({ path: testInfo.outputPath(`recovery-${locale}.png`) });
      restore();
      await page.getByRole("button", { name: locale === "en" ? "Try again" : "重试", exact: true }).click();
      await expect(page.locator(".portfolio-page")).toBeVisible();
      expect(new URL(page.url()).searchParams.get("sport")).toBe("Basketball");
      expect(new URL(page.url()).searchParams.get("sort")).toBe("yearAsc");
      await expect(page.locator(".page-recovery")).toHaveCount(0);
    } finally {
      restore();
      db.close();
    }
  });
}

for (const locale of ["zh", "en"]) test(`a failed comparison leaves the current portfolio available and can be retried (${locale})`, async ({ page, context }) => {
  if (locale === "en") await context.addCookies([{ name: "card_vault_ui_locale", value: "en", url: "http://127.0.0.1:3360" }]);
  const db = database();
  try {
    await page.goto("/portfolio?sport=Basketball&compareLeft=current&compareRight=view%3Arecovered-comparison");
    await expect(page.locator(".portfolio-page")).toBeVisible();
    await page.locator('details').filter({ has: page.locator('select[name="compareRight"]') }).locator('summary').click();
    await expect(page.locator('.portfolio-page').getByRole("alert")).toContainText(locale === "en" ? "missing or has been deleted" : "视图不存在");
    await expect(page.getByRole("button", { name: locale === "en" ? "Try again" : "重试", exact: true })).toBeVisible();
    await expect(page.locator("#portfolio-current-title")).toBeVisible();
    // Restore the missing source, then retry without changing the comparison query.
    db.prepare("INSERT INTO PortfolioSavedView(id,name,queryJson,updatedAt) VALUES('recovered-comparison','Recovered','{\"sport\":\"Basketball\"}',?)").run(Date.now());
    await page.getByRole("button", { name: locale === "en" ? "Try again" : "重试", exact: true }).click();
    await expect(page.locator('.portfolio-page').getByRole("alert")).toHaveCount(0);
    await expect(page.locator(".portfolio-page")).toBeVisible();
    expect(new URL(page.url()).searchParams.get("compareRight")).toBe("view:recovered-comparison");
  } finally {
    db.prepare("DELETE FROM PortfolioSavedView WHERE id='recovered-comparison'").run();
    db.close();
  }
});
