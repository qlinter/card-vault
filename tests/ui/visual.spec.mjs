import { expect, test } from "@playwright/test";

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
  test(`${target.name} visual baseline`, async ({ page }) => {
    await page.goto(target.path, { waitUntil: "networkidle" });
    if (target.name === "share-editor") {
      await page.getByRole("button", { name: /内容修改/ }).click();
      await expect(page.locator(".share-design-workspace")).toBeVisible();
    }
    await page.addStyleTag({
      content: "*,*::before,*::after{animation-duration:0s!important;transition-duration:0s!important;caret-color:transparent!important}"
    });
    await expect(page.locator(target.ready)).toBeVisible();
    await expect(page).toHaveScreenshot(`${target.name}.png`, { fullPage: true });
  });
}
