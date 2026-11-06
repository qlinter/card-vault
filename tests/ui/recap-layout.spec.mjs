import { expect, test } from "@playwright/test";

for (const theme of ["classic", "gallery", "midnight", "archive"]) test(`recap and immersive layout at minimum window (${theme})`, async ({ page, context }) => {
  await context.addCookies([{ name: "card_vault_app_theme", value: theme, url: "http://127.0.0.1:3360" }]);
  await page.setViewportSize({ width: 1100, height: 760 }); await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/portfolio/recap?recapYear=2026", { waitUntil: "networkidle" });
  await expect(page.locator(".recap-stats")).toBeVisible(); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole("button", { name: "赏卡：本期全部", exact: true }).click();
  const viewer = page.getByRole("dialog", { name: "沉浸式赏卡", exact: true }); await expect(viewer.getByRole("button", { name: "播放", exact: true })).toBeEnabled();
  const dimensions = await viewer.evaluate(element => ({ width: element.getBoundingClientRect().width, height: element.getBoundingClientRect().height, frame: element.querySelector(".immersive-art").getBoundingClientRect().height }));
  expect(dimensions.width).toBe(1100); expect(dimensions.height).toBe(760); expect(dimensions.frame).toBeGreaterThan(200);
  await page.keyboard.press("Escape"); await expect(viewer).toHaveCount(0);
});

test("recap visual baseline", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" }); await page.goto("/portfolio/recap?recapYear=2025", { waitUntil: "networkidle" });
  await expect(page.locator(".recap-page")).toBeVisible();
  await expect(page).toHaveScreenshot("collection-recap.png", { fullPage: true });
});
test("immersive visual baseline", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" }); await page.goto("/showcase?q=Jordan", { waitUntil: "networkidle" }); await page.getByRole("button", { name: "浏览", exact: true }).click();
  const viewer = page.getByRole("dialog", { name: "沉浸式赏卡", exact: true }); await expect(viewer.locator(".showcase-media-image")).toHaveAttribute("data-fitted", "true");
  await page.keyboard.press("Tab"); await expect(page).toHaveScreenshot("immersive-viewer.png");
});
