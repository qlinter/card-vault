import { test, expect } from "@playwright/test";
import { withUiDatabase as fixture } from "./database-fixture.mjs";
import { uiDatabasePath } from "./database-fixture.mjs";
import fs from "node:fs";
import path from "node:path";

test.beforeEach(() => fixture(db => db.exec(`
  INSERT INTO Card(id,playerName,cardTitle,sport,holdingQuantity) VALUES('conflict-card','Conflict Player','Conflict card','Basketball',1);
  INSERT INTO CardImage(id,cardId,path) VALUES('conflict-image','conflict-card','/media/ui-card-1.webp');
  INSERT INTO CardTransaction(id,cardId,kind,amountMinor,currency,quantity,occurredAt,provenance,notes) VALUES('conflict-transaction','conflict-card','purchase',10000,'CNY',1,'2026-01-01T00:00:00.000Z','test','original');
  INSERT INTO CardExpense(id,cardId,kind,context,amountMinor,currency,occurredAt,provenance,notes) VALUES('conflict-expense','conflict-card','grading','grading',1000,'CNY','2026-01-02T00:00:00.000Z','test','original');
  INSERT INTO CardValuation(id,cardId,amountMinor,currency,valuedAt,source,provenance,notes) VALUES('conflict-valuation','conflict-card',15000,'CNY','2026-01-03T00:00:00.000Z','个人估计','test','original');
  INSERT INTO ShareCollection(id,title,slug) VALUES('conflict-share','Original gallery','conflict-gallery');
  INSERT INTO ShareSection(id,shareCollectionId,title,layout,sortOrder) VALUES('conflict-section','conflict-share','Original section','grid',0);
  INSERT INTO ShareCollectionItem(id,shareCollectionId,cardId,sectionId,sortOrder) VALUES('conflict-item','conflict-share','ui-card-1','conflict-section',0);
`)));
test.afterEach(() => fixture(db => db.exec("DELETE FROM ShareCollection WHERE id='conflict-share'; DELETE FROM Card WHERE id='conflict-card';")));

for (const locale of ["zh", "en"]) for (const type of ["transaction", "expense", "valuation"]) test(`stale ${type} editors retain inputs and cannot overwrite or delete newer facts (${locale})`, async ({ page, context, baseURL }) => {
  if (locale === "en") await context.addCookies([{ name: "card_vault_ui_locale", value: "en", url: baseURL }]);
  const other = await context.newPage();
  const save = locale === "en" ? "Save Changes" : "保存修改";
  async function open(target) {
    await target.goto("/cards/conflict-card", { waitUntil: "networkidle" });
    const history = target.locator(".financial-history-details"); await history.locator(":scope > summary").click();
    const row = target.locator(`.financial-timeline-${type}`).first();
    await row.getByRole("button", { name: locale === "en" ? "Edit" : "编辑", exact: true }).click();
    return row;
  }
  try {
    const first = await open(page), stale = await open(other);
    await first.locator('[name="amount"]').fill("200");
    await stale.locator('[name="notes"]').fill("Unsaved note");
    await first.getByRole("button", { name: save, exact: true }).click();
    await expect(page).toHaveURL(/success=history-updated/);
    for (let attempt = 0; attempt < 2; attempt++) {
      await stale.getByRole("button", { name: save, exact: true }).click();
      await expect(stale.getByRole("alert")).toContainText(locale === "en" ? "latest changes were not overwritten" : "未覆盖最新内容");
      await expect(stale.locator('[name="notes"]')).toHaveValue("Unsaved note");
    }
    const table = { transaction: "CardTransaction", expense: "CardExpense", valuation: "CardValuation" }[type];
    expect(fixture(db => db.prepare(`SELECT amountMinor,notes FROM ${table} WHERE id=?`).get(`conflict-${type}`))).toEqual({ amountMinor: 20000, notes: "original" });
    await stale.getByRole("button", { name: locale === "en" ? "Delete This Record" : "删除这条记录", exact: true }).click();
    await expect(other).toHaveURL(/error=/);
    expect(fixture(db => db.prepare(`SELECT count(*) n FROM ${table} WHERE id=?`).get(`conflict-${type}`).n)).toBe(1);
  } finally { await other.close(); }
});

for (const locale of ["zh", "en"]) test(`stale share editors preserve uploads, selections and draft versions (${locale})`, async ({ page, context, baseURL }) => {
  if (locale === "en") await context.addCookies([{ name: "card_vault_ui_locale", value: "en", url: baseURL }]);
  const other = await context.newPage(), url = "/shares/conflict-share/edit";
  const save = locale === "en" ? "Confirm and Save" : "确认保存";
  async function open(target) {
    await target.goto(url, { waitUntil: "networkidle" });
    await target.getByRole("button", { name: locale === "en" ? "Next" : "下一步", exact: true }).click();
  }
  try {
    await open(page); await open(other);
    const staleVersion = await other.locator('[name="editVersion"]').inputValue();
    await page.locator('[name="title"]').fill("Latest gallery");
    await other.locator('[name="subtitle"]').fill("Unsaved subtitle");
    const upload = other.locator('input[type="file"][name="backgroundImage"]');
    await upload.setInputFiles("tests/fixtures/ui-media/showcase-bg.webp");
    await page.getByRole("button", { name: save, exact: true }).first().click();
    await expect(page).toHaveURL(/\/shares\?success=updated/);
    for (let attempt = 0; attempt < 2; attempt++) {
      await other.getByRole("button", { name: save, exact: true }).first().click();
      await expect(other.locator(".share-form").getByRole("alert")).toContainText(locale === "en" ? "latest changes were not overwritten" : "未覆盖最新内容");
      await expect(other.locator('[name="subtitle"]')).toHaveValue("Unsaved subtitle");
      expect(await upload.evaluate(input => input.files.length)).toBe(1);
      expect(fixture(db => db.prepare("SELECT title,subtitle,backgroundImagePath FROM ShareCollection WHERE id='conflict-share'").get())).toMatchObject({ title: "Latest gallery", subtitle: null, backgroundImagePath: null });
    }
    await other.reload({ waitUntil: "networkidle" });
    await other.getByRole("button", { name: locale === "en" ? "Restore Draft" : "恢复草稿", exact: true }).click();
    expect(await other.locator('[name="editVersion"]').inputValue()).toBe(staleVersion);
    await other.getByRole("button", { name: locale === "en" ? "Next" : "下一步", exact: true }).click();
    await other.getByRole("button", { name: save, exact: true }).first().click();
    await expect(other.locator(".share-form").getByRole("alert")).toContainText(locale === "en" ? "latest changes were not overwritten" : "未覆盖最新内容");
  } finally { await other.close(); }
});

test("simultaneous share saves commit one complete structure and clean losing uploads", async ({ page, context }) => {
  const other = await context.newPage();
  const directory = path.join(path.dirname(uiDatabasePath), "share-backgrounds");
  const before = fs.existsSync(directory) ? fs.readdirSync(directory).length : 0;
  try {
    for (const [index, target] of [page, other].entries()) {
      await target.goto("/shares/conflict-share/edit", { waitUntil: "networkidle" });
      await target.getByRole("button", { name: "下一步", exact: true }).click();
      await target.locator('[name="title"]').fill(`Concurrent gallery ${index}`);
      await target.locator('[name="backgroundImage"]').setInputFiles("tests/fixtures/ui-media/showcase-bg.webp");
    }
    await Promise.all([page, other].map(target => target.getByRole("button", { name: "确认保存", exact: true }).first().click()));
    await expect.poll(() => [page, other].filter(target => target.url().includes("success=updated")).length).toBe(1);
    const loser = page.url().includes("success=updated") ? other : page;
    await expect(loser.locator(".share-form").getByRole("alert")).toBeVisible();
    expect(fixture(db => db.prepare("SELECT count(*) n FROM ShareSection WHERE shareCollectionId='conflict-share'").get().n)).toBe(1);
    expect(fixture(db => db.prepare("SELECT count(*) n FROM ShareCollectionItem WHERE shareCollectionId='conflict-share'").get().n)).toBe(1);
    expect(fs.readdirSync(directory).length).toBe(before + 1);
  } finally { await other.close(); }
});
