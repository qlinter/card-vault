import { withUiDatabase as fixture } from './database-fixture.mjs';
import { expect, test } from "@playwright/test";
import fs from "node:fs";
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");
const file = name => ({ name, mimeType: "image/png", buffer: png });
const archiveTables = ["Card", "CardImage", "CardTransaction", "CardExpense", "CardValuation", "CardEntryTemplate", "ShareCollection", "ShareCollectionItem", "ShareSection", "CollectionTaskState", "CollectionPlan", "ScoutWatch", "ScoutWishDetails", "ScoutWishWatch", "ScoutWishCard", "PortfolioSnapshotRecord"];
const snapshot = () => fixture(db => Object.fromEntries(archiveTables.map(table => [table, db.prepare(`SELECT * FROM "${table}" ORDER BY rowid`).all()])));

let original;
const temporaryTables = ['Card', 'CardEntryDraft', 'CardEntryTemplate', 'CardEntryBatch'];
test.beforeEach(() => {
  original = fixture(db => ({
    ids: Object.fromEntries(temporaryTables.map(table => [table, new Set(db.prepare(`SELECT id FROM ${table}`).all().map(row => row.id))])),
    share: db.prepare("SELECT * FROM ShareCollection WHERE id='ui-share-1'").get(),
    sections: db.prepare("SELECT * FROM ShareSection WHERE shareCollectionId='ui-share-1'").all(),
    items: db.prepare("SELECT * FROM ShareCollectionItem WHERE shareCollectionId='ui-share-1'").all()
  }));
});
test.afterEach(async ({ page }) => {
  await page.goto('about:blank', { waitUntil: 'networkidle' });
  fixture(db => {
    db.exec('BEGIN IMMEDIATE');
    try {
      for (const table of temporaryTables) for (const row of db.prepare(`SELECT id FROM ${table}`).all()) {
        if (!original.ids[table].has(row.id)) db.prepare(`DELETE FROM ${table} WHERE id=?`).run(row.id);
      }
      db.exec("DELETE FROM ShareCollectionItem WHERE shareCollectionId='ui-share-1'; DELETE FROM ShareSection WHERE shareCollectionId='ui-share-1'");
      const { id, ...values } = original.share;
      db.prepare(`UPDATE ShareCollection SET ${Object.keys(values).map(key => `${key}=?`).join(',')} WHERE id=?`).run(...Object.values(values), id);
      for (const [table, rows] of [['ShareSection', original.sections], ['ShareCollectionItem', original.items]]) for (const row of rows) {
        db.prepare(`INSERT INTO ${table} (${Object.keys(row).join(',')}) VALUES (${Object.keys(row).map(() => '?').join(',')})`).run(...Object.values(row));
      }
      db.exec('COMMIT');
    } catch (error) { db.exec('ROLLBACK'); throw error; }
  });
});

test("browsing simplified pages preserves existing archives, relations and database schema", async ({ page }) => {
  fixture(db => db.exec("INSERT INTO Card(id,playerName,cardTitle,sport,holdingQuantity) VALUES('stage1-incomplete','Stage 1 review','Incomplete archive','Basketball',1)"));
  const before = snapshot();
  const schema = fixture(db => db.prepare("SELECT name,sql FROM sqlite_master WHERE type IN ('table','index','trigger') ORDER BY name").all());
  for (const route of ["/", "/cards/ui-card-2", "/portfolio", "/shares/ui-share-1/edit", "/collection", "/settings/data"]) {
    const response = await page.goto(route, { waitUntil: "networkidle" });
    expect(response.status()).toBe(200);
  }
  expect(snapshot()).toEqual(before);
  expect(fixture(db => db.prepare("SELECT name,sql FROM sqlite_master WHERE type IN ('table','index','trigger') ORDER BY name").all())).toEqual(schema);
  await page.route("**/api/ai/portfolio-analysis", route => route.fulfill({ status: 503, json: { error: "Stage 1: offline analysis check" } }));
  await page.goto("/portfolio", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "组合分析", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("dialog")).toContainText("Stage 1: offline analysis check");
  await page.keyboard.press("Escape");
  await expect(page.locator(".overview-digest")).toBeVisible();
  await page.getByRole("link", { name: /待完善数据/ }).click();
  await page.locator(".collection-follow-up-toggle").click();
  await expect(page.locator(".overview-review-list")).toBeVisible();
});

test("compact collection filters preserve scope and the saved valuation mask", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("card-vault:valuation-hidden", "true"));
  await page.goto("/", { waitUntil: "networkidle" });
  await expect(page.locator(".collection-summary")).toBeVisible();
  await expect(page.locator(".valuation-total-item")).toHaveText("••••••");
  await expect(page.locator('.home-filter-form > .filters > input[name="q"]')).toBeVisible();
  await expect(page.locator('.home-filter-form > .filters > select[name="collectionStatus"]')).toBeVisible();
  await expect(page.locator('.home-filter-form > .filters > select[name="sort"]')).toBeVisible();
  await expect(page.locator('select[name="year"]')).not.toBeVisible();
  await page.locator('input[name="q"]').fill("Jordan");
  await page.locator('select[name="collectionStatus"]').selectOption("holding");
  await page.locator('select[name="sort"]').selectOption("yearDesc");
  await page.getByRole("button", { name: "搜索 / 筛选", exact: true }).click();
  await expect(page.locator('[data-testid="home-card-grid"] .card-item')).toHaveCount(1);
  const chip = page.locator('.collection-filter-chips a[href*="q=Jordan"]').filter({ hasText: "收藏状态" });
  await chip.click();
  expect(new URL(page.url()).searchParams.get("q")).toBe("Jordan");
  expect(new URL(page.url()).searchParams.get("sort")).toBe("yearDesc");
  expect(new URL(page.url()).searchParams.has("collectionStatus")).toBe(false);
  await expect(page.locator('[data-testid="home-card-grid"] .card-item')).toHaveCount(1);
});

test("folded finance, images and zero purchase price survive draft recovery and saving", async ({ page }) => {
  await page.goto("/cards/new", { waitUntil: "networkidle" });
  await expect(page.locator('input[name="purchasePrice"]')).not.toBeVisible();
  expect(await page.locator('[data-card-entry-form]').evaluate(form => new FormData(form).get("initialQuantity"))).toBe("1");
  await page.locator('[data-card-entry-form] input[name="images"]').setInputFiles(file("stage1-card.png"));
  await page.locator('input[name="playerName"]').fill("Stage 1 draft subject");
  await page.locator('input[name="cardTitle"]').fill("Stage 1 zero purchase");
  await page.locator('input[name="sport"]').fill("Basketball");
  await page.locator('input[name="sport"]').blur();
  await page.getByText("财务记录（可选）", { exact: true }).click();
  await page.locator('input[name="purchasePrice"]').fill("0");
  await page.locator('input[name="purchaseDate"]').fill("2026-10-20");
  await expect(page.locator(".entry-draft-status")).toContainText("已保存");
  await expect.poll(() => new URL(page.url()).searchParams.get("draft")).toBeTruthy();
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.locator('input[name="purchasePrice"]')).toBeVisible();
  await expect(page.locator('input[name="purchasePrice"]')).toHaveValue("0");
  await expect.poll(() => page.locator('[data-card-entry-form] input[name="images"]').evaluate(input => input.files.length)).toBe(1);
  await page.getByText("财务记录（可选）", { exact: true }).click();
  await page.getByRole("button", { name: "保存并查看", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Stage 1 draft subject", exact: true })).toBeVisible();
  const saved = fixture(db => db.prepare("SELECT c.id,c.visibility,c.holdingQuantity,t.amountMinor,t.amountKnown FROM Card c JOIN CardTransaction t ON t.cardId=c.id WHERE c.cardTitle='Stage 1 zero purchase'").get());
  expect(saved.visibility).toBe("private");
  expect(saved.holdingQuantity).toBe(1);
  expect(saved.amountMinor).toBe(0);
  expect(saved.amountKnown).toBe(1);
  expect(fixture(db => db.prepare("SELECT COUNT(*) total FROM CardImage WHERE cardId=?").get(saved.id).total)).toBe(1);
  await page.goto("/cards/new", { waitUntil: "networkidle" });
  await expect(page.locator('input[name="sport"]')).toHaveValue("Basketball");
});

test("entry tools apply templates and import a batch without submitting the card form", async ({ page, request, baseURL }) => {
  const response = await request.post("/api/card-entry/templates", { headers: { Origin: baseURL }, data: { name: "Stage 1 template", values: { sport: "Football", brand: "Stage 1 brand", productLine: "Stage 1 line" } } });
  expect(response.ok()).toBe(true);
  await page.goto("/cards/new", { waitUntil: "networkidle" });
  await page.locator(".entry-tools > summary").click();
  await page.locator(".entry-template-panel > summary").click();
  const template = page.locator(".entry-template-panel");
  const id = await template.locator('select option').filter({ hasText: "Stage 1 template" }).getAttribute("value");
  await template.locator("select").selectOption(id);
  await template.getByRole("button", { name: "应用", exact: true }).click();
  await expect(page.locator('input[name="brand"]')).toHaveValue("Stage 1 brand");
  await expect(page.locator('input[name="sport"]')).toHaveValue("Football");
  await page.locator(".entry-queue-panel > summary").click();
  await page.locator('.entry-queue-import input[type="file"]').setInputFiles([file("front.png"), file("back.png")]);
  const beforeCount = fixture(db => db.prepare("SELECT COUNT(*) total FROM Card").get().total);
  await page.getByRole("button", { name: "导入并预处理", exact: true }).click();
  await expect(page.getByRole("link", { name: "进入录入", exact: true }).first()).toBeVisible();
  expect(fixture(db => db.prepare("SELECT COUNT(*) total FROM Card").get().total)).toBe(beforeCount);
  expect(await page.locator('.entry-queue-import').evaluate(form => Boolean(form.closest('[data-card-entry-form]')))).toBe(false);
  await page.getByRole('button', { name: '选择语言', exact: true }).click();
  await page.getByRole('menuitemradio', { name: 'English', exact: true }).click();
  await expect(page.locator('.entry-queue-panel')).not.toContainText(/[\u3400-\u9fff]/u);
});

test("two-step share saving preserves legacy sections, stories, design and archive data", async ({ page }) => {
  const shareId = "ui-share-1";
  const before = fixture(db => ({
    share: db.prepare("SELECT * FROM ShareCollection WHERE id=?").get(shareId),
    sections: db.prepare("SELECT id,title,description,layout,sortOrder FROM ShareSection WHERE shareCollectionId=? ORDER BY sortOrder").all(shareId),
    items: db.prepare("SELECT cardId,sectionId,sortOrder,displayTitle,displayDescription FROM ShareCollectionItem WHERE shareCollectionId=? ORDER BY sortOrder").all(shareId),
    cards: db.prepare("SELECT * FROM Card ORDER BY id").all()
  }));
  let aiRequests = 0;
  await page.route("**/api/ai/share-theme", route => { aiRequests++; return route.abort(); });
  await page.goto(`/shares/${shareId}/edit`, { waitUntil: "networkidle" });
  await expect(page.locator(".share-wizard-step")).toHaveCount(2);
  await page.getByRole("button", { name: /预览并保存/ }).click();
  await expect(page.locator('input[name="title"]')).toBeVisible();
  await expect(page.locator(".share-template-options")).toBeVisible();
  await expect(page.locator('input[aria-label="文字面板不透明度"]')).not.toBeVisible();
  const fields = ["theme", "layout", "templateId", "backgroundPositionX", "backgroundPositionY", "panelOpacity", "typography", "density", "imageFit", "textScale", "featuredCardIdsJson", "sectionsJson", "themeNarrative", "themeHighlights", "groupNotes", "existingCoverImagePath", "existingBackgroundImagePath"];
  const formValues = () => page.locator("form.share-form").evaluate((form, fields) => {
    const data = new FormData(form); return Object.fromEntries(fields.map(field => [field, data.get(field)]));
  }, fields);
  const oldValues = await formValues();
  await page.locator('input[name="title"]').fill("Stage 1 saved gallery");
  await page.getByRole("button", { name: "确认保存", exact: true }).first().click();
  await expect(page).toHaveURL(/\/shares\?/);
  expect(aiRequests).toBe(0);
  const after = fixture(db => ({
    share: db.prepare("SELECT * FROM ShareCollection WHERE id=?").get(shareId),
    sections: db.prepare("SELECT id,title,description,layout,sortOrder FROM ShareSection WHERE shareCollectionId=? ORDER BY sortOrder").all(shareId),
    items: db.prepare("SELECT cardId,sectionId,sortOrder,displayTitle,displayDescription FROM ShareCollectionItem WHERE shareCollectionId=? ORDER BY sortOrder").all(shareId),
    cards: db.prepare("SELECT * FROM Card ORDER BY id").all()
  }));
  // The existing save action regenerates section IDs and remaps item relations.
  // Compare section content and the meaning of each relation rather than storage IDs.
  const withoutId = row => { const result = { ...row }; delete result.id; return result; };
  const sectionContent = rows => rows.map(withoutId);
  const linkedItems = value => value.items.map(({ sectionId, ...row }) => ({ ...row, section: value.sections.find(section => section.id === sectionId)?.title || null }));
  expect(sectionContent(after.sections)).toEqual(sectionContent(before.sections));
  expect(linkedItems(after)).toEqual(linkedItems(before));
  expect(after.cards).toEqual(before.cards);
  const text = value => typeof value === "string" ? value.replaceAll("\r\n", "\n") : value;
  for (const field of ["subtitle", "description", "themeNarrative", "themeHighlights", "groupNotes", "coverImagePath", "backgroundImagePath", "theme"]) expect(text(after.share[field])).toBe(text(before.share[field]));
  await page.goto(`/shares/${shareId}/edit`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /预览并保存/ }).click();
  const newValues = await formValues();
  const normalizeSections = value => JSON.parse(value).map(withoutId);
  expect(normalizeSections(newValues.sectionsJson)).toEqual(normalizeSections(oldValues.sectionsJson));
  delete newValues.sectionsJson;
  delete oldValues.sectionsJson;
  const normalizeTextFields = values => Object.fromEntries(Object.entries(values).map(([key, value]) => [key, text(value)]));
  expect(normalizeTextFields(newValues)).toEqual(normalizeTextFields(oldValues));
  await page.locator(".share-custom-tools > summary").click();
  await page.getByRole("button", { name: "展馆章节", exact: true }).click();
  await expect(page.locator('.share-section-editor-list').getByRole("textbox").first()).toHaveValue(before.sections[0].title);
});

test("stage 1 pages fit the minimum desktop window in every theme and translate their new controls", async ({ page, context }) => {
  fs.mkdirSync("logs", { recursive: true });
  await page.setViewportSize({ width: 1100, height: 850 });
  for (const theme of ["classic", "gallery", "midnight", "archive"]) {
    await context.addCookies([{ name: "card_vault_app_theme", value: theme, url: "http://127.0.0.1:3360" }]);
    for (const [name, route] of [["home", "/"], ["entry", "/cards/new"], ["detail", "/cards/ui-card-2"], ["share", "/shares/ui-share-1/edit"]]) {
      await page.goto(route, { waitUntil: "networkidle" });
      if (name === "share") await page.getByRole("button", { name: /预览并保存/ }).click();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${theme}/${name} must fit`).toBe(true);
      if (theme === "classic" || theme === "midnight") await page.screenshot({ path: `logs/v1.5.0-${theme}-${name}.png`, fullPage: true, animations: "disabled" });
    }
  }
  await context.addCookies([{ name: "card_vault_ui_locale", value: "en", url: "http://127.0.0.1:3360" }]);
  await page.goto("/cards/ui-card-2", { waitUntil: "networkidle" });
  await page.getByRole('button', { name: 'Add Financial Record', exact: true }).click();
  await page.getByRole('combobox', { name: 'Record type', exact: true }).selectOption('sale');
  await expect(page.locator('#financial-add-record form:visible [name="kind"]')).toHaveValue("sale");
  await expect(page.locator('.info-grid')).not.toContainText("证书号");
  await page.goto("/cards/new", { waitUntil: "networkidle" });
  await expect(page.getByText("Entry tools", { exact: true })).toBeVisible();
  await expect(page.getByText("Financial records (optional)", { exact: true })).toBeVisible();
});
