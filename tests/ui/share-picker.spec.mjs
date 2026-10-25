import { withUiDatabase as fixture } from './database-fixture.mjs';
import { expect, test } from "@playwright/test";
import fs from "node:fs";
const subject = "Picker UI · A long collection subject with several words";
const title = "2024 Detailed archive " + "LongCardTitleWithoutSpaces".repeat(4);
test.beforeEach(() => fixture(db => {
  const insert = db.prepare("INSERT INTO Card(id,playerName,cardTitle,sport,year,brand,productLine,gradingCompany,grade,publicDescription,notes) VALUES(?,?,?,'Basketball',?,?,?,?,?,?,?)");
  insert.run("picker-ui-a", subject, title, "2024", "A lengthy brand name", "A collection series with a long name", "PSA", "10", "Original public description", "Private archive notes");
  insert.run("picker-ui-b", "Picker UI · Second subject", "Second selectable archive", null, null, null, null, null, null, "Keep private notes");
  db.prepare("INSERT INTO CardImage(id,cardId,path) VALUES('picker-ui-image','picker-ui-a','/media/ui-card-1.webp')").run();
}));
test.afterEach(() => fixture(db => db.exec("DELETE FROM ShareCollection WHERE title='Picker UI saved share'; DELETE FROM Card WHERE id LIKE 'picker-ui-%'")));

async function openPicker(page) {
  await page.goto("/shares/new", { waitUntil: "networkidle" });
  await page.locator(".share-card-search input").fill("Picker UI");
  const cards = page.locator(".share-card-option:not([hidden])");
  await expect(cards).toHaveCount(2);
  return cards;
}

test("picker sorting and overrides survive filtering and save without changing card archives", async ({ page }) => {
  const before = fixture(db => db.prepare("SELECT * FROM Card WHERE id LIKE 'picker-ui-%' ORDER BY id").all());
  const cards = await openPicker(page);
  const first = cards.filter({ has: page.getByRole("heading", { name: subject, exact: true }) });
  const second = cards.filter({ hasText: "Second selectable archive" });
  await first.getByRole("checkbox").check(); await second.getByRole("checkbox").check();
  await first.locator(".share-sort-field input").fill("8");
  await second.locator(".share-sort-field input").fill("2");
  await first.locator(".share-card-overrides > summary").click();
  const customTitle = "A public display title & original collection story";
  const story = "First paragraph of the public card story.\nSecond paragraph with context and provenance.";
  await first.getByLabel("展示标题", { exact: true }).fill(customTitle);
  await first.getByLabel("卡片故事（公开）", { exact: true }).fill(story);
  await page.locator(".share-card-search input").fill("Second selectable");
  await expect(cards).toHaveCount(1);
  await page.locator(".share-card-search input").fill("Picker UI");
  await expect(first.getByRole("checkbox")).toBeChecked();
  await expect(first.getByLabel("展示标题", { exact: true })).toHaveValue(customTitle);
  await expect(first.getByRole("textbox", { name: "卡片故事（公开）", exact: true })).toHaveValue(story);
  await page.getByRole("button", { name: /预览并保存/ }).click();
  await page.locator('input[name="title"]').fill("Picker UI saved share");
  await page.getByRole("button", { name: "确认保存", exact: true }).first().click();
  await expect(page).toHaveURL(/\/shares\?/);
  const saved = fixture(db => db.prepare("SELECT cardId,displayTitle,displayDescription FROM ShareCollectionItem WHERE shareCollectionId=(SELECT id FROM ShareCollection WHERE title='Picker UI saved share') ORDER BY sortOrder").all());
  expect(saved.map(row => row.cardId)).toEqual(["picker-ui-b", "picker-ui-a"]);
  expect(saved[1].displayTitle).toBe(customTitle);
  expect(saved[1].displayDescription.replaceAll("\r\n", "\n")).toBe(story);
  expect(fixture(db => db.prepare("SELECT * FROM Card WHERE id LIKE 'picker-ui-%' ORDER BY id").all())).toEqual(before);
});

test("long card information and expanded overrides remain readable in every theme", async ({ page, context }) => {
  test.setTimeout(120000);
  fs.mkdirSync("logs", { recursive: true });
  for (const theme of ["classic", "gallery", "midnight", "archive"]) {
    await context.addCookies([{ name: "card_vault_app_theme", value: theme, url: "http://127.0.0.1:3360" }]);
    for (const width of [1100, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      const cards = await openPicker(page);
      const first = cards.filter({ has: page.getByRole("heading", { name: subject, exact: true }) });
      await first.locator(".share-card-overrides > summary").click();
      await first.getByLabel("展示标题", { exact: true }).fill("Long display title ".repeat(8));
      await first.getByLabel("卡片故事（公开）", { exact: true }).fill("A public story with several paragraphs.\n".repeat(15));
      const geometry = await first.evaluate(card => {
        const bounds = card.getBoundingClientRect();
        return { width: card.clientWidth, scrollWidth: card.scrollWidth, bounds: { left: bounds.left, right: bounds.right }, controls: [...card.querySelectorAll("input,textarea")].map(control => { const box = control.getBoundingClientRect(); return { left: box.left, right: box.right, width: box.width, type: control.type }; }) };
      });
      expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.width + 1);
      for (const control of geometry.controls) {
        expect(control.left).toBeGreaterThanOrEqual(geometry.bounds.left);
        expect(control.right).toBeLessThanOrEqual(geometry.bounds.right + 1);
        if (["text", "textarea"].includes(control.type)) expect(control.width).toBeGreaterThanOrEqual(250);
      }
      await expect(cards.last().locator(".share-card-metadata dd")).toHaveText(["–", "–", "–", "–"]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: `logs/v1.5.0-picker-${theme}-${width}.png`, fullPage: true });
    }
  }
});
