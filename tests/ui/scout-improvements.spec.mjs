import { expect, test } from "@playwright/test";
test("unused scout storage is ignored without deletion and independent entry works in both languages", async ({ page, context }) => {
  await page.addInitScript(() => {
    localStorage.setItem("card-vault:scout:2:old:drafts", '{"old":true}');
    sessionStorage.setItem("card-vault:scout-scroll:old", "malformed");
  });
  await page.goto("/collection?tab=wishlist&watch=removed&wish=removed", { waitUntil: "networkidle" });
  await expect(page.locator(".scout-query")).toBeVisible();
  await expect(page.getByRole("button", { name: "新增心愿", exact: true })).toBeEnabled();
  expect(await page.evaluate(() => localStorage.getItem("card-vault:scout:2:old:drafts"))).toBe('{"old":true}');
  expect(await page.evaluate(() => sessionStorage.getItem("card-vault:scout-scroll:old"))).toBe("malformed");
  await context.addCookies([{ name: "card_vault_ui_locale", value: "en", url: "http://127.0.0.1:3360" }]);
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("button", { name: "New wish", exact: true }).click();
  await expect(page.getByLabel("Wish title *", { exact: true })).toBeVisible();
  expect(await page.locator(".scout-page").innerText()).not.toMatch(/[\u3400-\u9fff]/u);
  for (const field of ["Priority", "Target date", "Target count", "Acquired", "Bind cards"]) await expect(page.getByLabel(field, { exact: true })).toHaveCount(0);
});
test("simple scout panels and long wishes fit the four themes at minimum and regular desktop sizes", async ({ page, context }) => {
  test.setTimeout(120000);
  await page.goto("/collection", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "新增心愿", exact: true }).click();
  await page.getByLabel("心愿名称 *", { exact: true }).fill("Extended collection wish ".repeat(12));
  await page.getByLabel("备注（可选）", { exact: true }).fill("Long note ".repeat(300));
  for (const theme of ["classic", "gallery", "midnight", "archive"]) for (const width of [1100, 1440]) {
    await context.addCookies([{ name: "card_vault_app_theme", value: theme, url: "http://127.0.0.1:3360" }]);
    await page.setViewportSize({ width, height: 900 });
    await page.reload({ waitUntil: "networkidle" });
    await expect(page.getByLabel("心愿名称 *", { exact: true })).toHaveValue("Extended collection wish ".repeat(12));
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    expect(await page.locator(".scout-page :is(input,textarea,select,.btn)").evaluateAll(elements => elements.filter(element => element.checkVisibility()).every(element => { const r = element.getBoundingClientRect(), p = element.closest(".panel").getBoundingClientRect(); return r.left >= p.left && r.right <= p.right; }))).toBe(true);
  }
});
