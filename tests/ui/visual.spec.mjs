import { expect, test } from "@playwright/test";

const screenshotMode = process.env.CARD_VAULT_UI_SCREENSHOT_MODE || "compare";
if (!new Set(["compare", "capture"]).has(screenshotMode)) {
  throw new Error(`Unknown CARD_VAULT_UI_SCREENSHOT_MODE: ${screenshotMode}`);
}

const pages = [
  { name: "home", path: "/", ready: ".summary-grid" },
  { name: "card-entry", path: "/cards/new", ready: ".entry-workbench-layout" },
  { name: "portfolio", path: "/portfolio", ready: ".portfolio-page" },
  { name: "share-editor", path: "/shares/ui-share-1/edit", ready: ".shares-page" },
  { name: "settings", path: "/settings", ready: ".settings-page" }
];

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
});

for (const target of pages) {
  test(`${target.name} visual baseline`, async ({ page }, testInfo) => {
    await page.goto(target.path, { waitUntil: "networkidle" });
    if (target.name === "share-editor") {
      await page.getByRole("button", { name: /内容修改/ }).click();
      await expect(page.locator(".share-design-workspace")).toBeVisible();
    }
    await page.addStyleTag({
      content: "*,*::before,*::after{animation-duration:0s!important;transition-duration:0s!important;caret-color:transparent!important}"
    });
    await expect(page.locator(target.ready)).toBeVisible();
    if (screenshotMode === "capture") {
      // GitHub-hosted Windows images and local Windows machines rasterize fonts
      // differently. Keep the same page matrix in CI without treating those
      // environment-only pixels as a release failure.
      await testInfo.attach(`${target.name}-${testInfo.project.name}`, {
        body: await page.screenshot({ fullPage: true }),
        contentType: "image/png"
      });
    } else {
      await expect(page).toHaveScreenshot(`${target.name}.png`, { fullPage: true });
    }
  });
}
