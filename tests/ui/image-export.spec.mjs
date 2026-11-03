import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { withUiDatabase as fixture } from "./database-fixture.mjs";
const { Open } = createRequire(import.meta.url)("unzipper");
const original = new URL("../.ui-test-runtime/data/uploads/ui-card-1.webp", import.meta.url);

test.afterEach(() => fixture(db => db.exec("DELETE FROM Card WHERE id='image-export-ui'")));

for (const locale of ["zh", "en"]) test(`both card views export original files and fit at 320px (${locale})`, async ({ page, context }, testInfo) => {
  if (locale === "en") await context.addCookies([{ name: "card_vault_ui_locale", value: "en", url: "http://127.0.0.1:3360" }]);
  const label = locale === "en" ? "Export images" : "导出图片";
  for (const prefix of ["/cards", "/showcase/cards"]) {
    await page.goto(`${prefix}/ui-card-1`, { waitUntil: "networkidle" });
    const button = page.getByRole("button", { name: label, exact: true });
    await expect(button).toHaveText("");
    await expect(button.locator("svg")).toHaveCount(1);
    if (prefix.includes("showcase")) {
      const expand = page.getByRole("button", { name: locale === "en" ? "View full image" : "查看大图", exact: true });
      await expect(expand).toHaveText("");
      const exportBox = await button.boundingBox(), expandBox = await expand.boundingBox();
      expect(Math.abs(exportBox.y - expandBox.y)).toBeLessThan(1);
      expect(exportBox.x).toBeGreaterThanOrEqual(expandBox.x + expandBox.width);
      await expand.click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await page.keyboard.press("Escape");
    } else {
      await expect(page.locator(".card-images-heading").getByRole("button", { name: label, exact: true })).toBeVisible();
    }
    const downloading = page.waitForEvent("download");
    await button.click();
    const download = await downloading;
    expect(download.suggestedFilename()).toBe("2024 Championship Rookie Auto-01.webp");
    expect(await readFile(await download.path())).toEqual(await readFile(original));
    for (const width of [1440, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      await expect(button).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const bounds = await button.boundingBox();
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
      await testInfo.attach(`${prefix.includes("showcase") ? "showcase" : "collection"}-${width}`, { body: await page.screenshot({ path: `logs/v1.5.1-export-${prefix.includes("showcase") ? "showcase" : "collection"}-${locale}-${width}.png`, fullPage: true }), contentType: "image/png" });
    }
  }
});

test("images with the same upload timestamp download a complete ZIP in display order, while missing images fail visibly and can retry", async ({ page, request }) => {
  fixture(db => {
    db.exec("INSERT INTO Card(id,playerName,cardTitle,sport) VALUES('image-export-ui','Export fixture','导出 / 原图','Basketball'); INSERT INTO CardImage(id,cardId,path,rotation,createdAt) VALUES('export-z','image-export-ui','/media/ui-card-1.webp',90,1000),('export-a','image-export-ui','/media/ui-card-2.webp',0,1000)");
  });
  const response = await request.get("/api/cards/image-export-ui/images/export");
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toBe("application/zip");
  const archive = await Open.buffer(await response.body());
  expect(archive.files.map(file => file.path)).toEqual(["导出 - 原图-01.webp", "导出 - 原图-02.webp"]);
  expect(await archive.files[0].buffer()).toEqual(await readFile(original));
  expect((await request.get("/api/cards/no-such-card/images/export")).status()).toBe(404);
  fixture(db => db.exec("UPDATE CardImage SET path='/media/missing.webp' WHERE id='export-a'"));
  await page.goto("/cards/image-export-ui", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "导出图片", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "图片导出失败" })).toBeVisible();
  fixture(db => db.exec("UPDATE CardImage SET path='/media/ui-card-2.webp' WHERE id='export-a'"));
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出图片", exact: true }).click();
  expect((await downloading).suggestedFilename()).toBe("导出 - 原图-images.zip");
  await expect(page.getByRole("alert").filter({ hasText: "图片导出失败" })).toBeHidden();
  fixture(db => db.exec("DELETE FROM CardImage WHERE cardId='image-export-ui'"));
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.getByRole("button", { name: "导出图片", exact: true })).toHaveCount(0);
});
