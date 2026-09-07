import { expect, test } from "@playwright/test";
import { DatabaseSync } from "node:sqlite";
import path from "node:path";
function fixture(action) { const db = new DatabaseSync(path.resolve("tests/.ui-test-runtime/data/dev.db")); try { db.exec("PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000"); return action(db); } finally { db.close(); } }
test.beforeEach(() => fixture(db => {
  db.prepare("INSERT INTO Card(id,playerName,cardTitle,sport,tags,notes) VALUES('management-ui','卡片数量','备注','Basketball','公开,标签','保存')").run();
  db.prepare("INSERT INTO CardImage(id,cardId,path) VALUES('management-ui-image','management-ui','/media/ui-card-1.webp')").run();
}));
test.afterEach(() => fixture(db => { db.exec("DELETE FROM Card WHERE id='management-ui' OR playerName='Import UI'; DELETE FROM ShareCollection WHERE id='more-actions-ui'; DELETE FROM BulkJob; DELETE FROM CollectionPlan WHERE title='UI wishlist'; DELETE FROM CollectionTaskState WHERE id LIKE 'management-ui:%';"); }));
test("language switches leave dictionary-like user content unchanged", async ({ page }) => {
  await page.goto("/?q=卡片数量", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "选择语言" }).click(); await page.getByRole("menuitemradio", { name: "English" }).click();
  const card = page.getByTestId("home-card-grid"); await expect(card.getByRole("heading", { name: "卡片数量" })).toBeVisible(); await expect(card.getByText("备注", { exact: true })).toBeVisible(); await expect(card.getByText("公开", { exact: true })).toBeVisible();
  await card.locator("a").click(); await expect(page.locator(".details")).toContainText("卡片数量");
  await page.goto("/cards/management-ui/edit", { waitUntil: "networkidle" });
  await expect(page.locator('[name="playerName"]')).toHaveValue("卡片数量"); await expect(page.locator('[name="cardTitle"]')).toHaveValue("备注");
  await page.getByRole("button", { name: "Choose language" }).click(); await page.getByRole("menuitemradio", { name: "简体中文" }).click(); await expect(page.locator('[name="notes"]')).toHaveValue("保存");
});
test("failed edit retains fields, choices and newly selected images", async ({ page }) => {
  await page.goto("/cards/management-ui/edit", { waitUntil: "networkidle" });
  await page.locator('[name="playerName"]').fill("输入保留测试"); await page.locator('[name="gradingLink"]').fill("ftp://example.test/cert"); await page.locator('[name="isRookie"]').check();
  await page.locator('[name="images"]').setInputFiles({ name: "selected.png", mimeType: "image/png", buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j9wAAAABJRU5ErkJggg==", "base64") });
  await page.getByRole("button", { name: "保存修改", exact: true }).click();
  await expect(page.locator(".note-error")).toContainText("http 或 https"); await expect(page.locator('[name="playerName"]')).toHaveValue("输入保留测试"); await expect(page.locator('[name="isRookie"]')).toBeChecked(); expect(await page.locator('[name="images"]').evaluate(input => input.files.length)).toBe(1);
  expect(fixture(db => db.prepare("SELECT playerName FROM Card WHERE id='management-ui'").get().playerName)).toBe("卡片数量");
});
test("failed financial record preserves entered values and leaves history unchanged", async ({ page }) => {
  await page.goto("/cards/management-ui", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "＋ 新增记录", exact: true }).click();
  const form = page.locator("#financial-add-record form:visible");
  await form.locator('[name="kind"]').selectOption("sale");
  await form.locator('[name="amount"]').fill("12.34");
  await form.locator('[name="quantity"]').fill("50");
  await form.locator('[name="occurredAt"]').fill("2026-09-01");
  await form.locator('[name="notes"]').fill("保留这笔未提交记录");
  await form.getByRole("button", { name: "保存交易" }).click();
  await expect(form.getByRole("alert")).toBeVisible();
  await expect(form.locator('[name="kind"]')).toHaveValue("sale");
  await expect(form.locator('[name="amount"]')).toHaveValue("12.34");
  await expect(form.locator('[name="quantity"]')).toHaveValue("50");
  await expect(form.locator('[name="notes"]')).toHaveValue("保留这笔未提交记录");
  expect(fixture(db => db.prepare("SELECT COUNT(*) n FROM CardTransaction WHERE cardId='management-ui'").get().n)).toBe(0);
});
test("import preview applies a card and a confirmed undo removes it", async ({ page }) => {
  await page.goto("/settings/data", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "表格视图", exact: true }).click();
  await page.getByRole("button", { name: "选择全部", exact: true }).click();
  await expect(page.locator("tbody input[type=checkbox]").first()).toBeChecked();
  await page.getByRole("button", { name: "列表视图", exact: true }).click();
  await page.getByRole("button", { name: "清空选择", exact: true }).click();
  await page.getByLabel("选择文件").setInputFiles({ name: "cards.csv", mimeType: "text/csv", buffer: Buffer.from("playerName,cardTitle,sport\nImport UI,00123,Basketball") });
  await page.getByRole("button", { name: "建立导入预演" }).click(); await expect(page.getByRole("heading", { name: "批次预演与结果" })).toBeVisible();
  await page.getByRole("button", { name: "执行 / 重试失败行" }).click(); await expect(page.locator("tbody tr").first()).toContainText("已完成");
  expect(fixture(db => db.prepare("SELECT cardTitle FROM Card WHERE playerName='Import UI'").get().cardTitle)).toBe("00123");
  await page.getByRole("button", { name: "撤销本批次" }).click(); await page.getByRole("button", { name: "确认撤销" }).click(); await expect(page.locator("tbody tr").first()).toContainText("已撤销");
  expect(fixture(db => db.prepare("SELECT COUNT(*) n FROM Card WHERE playerName='Import UI'").get().n)).toBe(0);
});
test("wishlist budget persists and reminders can be snoozed", async ({ page }, testInfo) => {
  await page.goto("/collection", { waitUntil: "networkidle" });
  await page.locator(".wish-disclosure > summary").first().click();
  await page.getByLabel("心愿名称", { exact: true }).fill("UI wishlist"); await page.getByLabel("预算", { exact: true }).fill("88.25"); await page.getByRole("button", { name: "添加心愿" }).click(); await expect(page.getByText("UI wishlist", { exact: true })).toBeVisible();
  await expect(page.locator(".wish-meta .record-status")).toHaveText("待实现");
  const task = page.locator(".management-task").filter({ hasText: "卡片数量" }).first(); await task.getByRole("button", { name: "延后 7 天" }).click();
  await page.reload({ waitUntil: "networkidle" }); await expect(page.getByText("UI wishlist", { exact: true })).toBeVisible();
  expect(fixture(db => db.prepare("SELECT budgetMinor FROM CollectionPlan WHERE title='UI wishlist'").get().budgetMinor)).toBe(8825);
  expect(fixture(db => db.prepare("SELECT status FROM CollectionTaskState WHERE id LIKE 'management-ui:%'").get().status)).toBe("snoozed");
  await page.getByLabel("显示已处理").check();
  await expect(page.locator(".management-task small").filter({ hasText: "已延后" })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("plans-with-data.png"), fullPage: true });
  await page.getByRole("button", { name: "选择语言" }).click();
  await page.getByRole("menuitemradio", { name: "English" }).click();
  await expect(page.locator(".wish-meta .record-status")).toHaveText("Planned");
  await expect(page.locator(".management-task small").filter({ hasText: "Snoozed" })).toBeVisible();
});

test("management titles follow the locale and Settings owns the shared user guide", async ({ page }) => {
  await page.goto("/settings/data", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("数据");
  await expect(page.getByLabel("修改字段")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "预演批量修改" })).toHaveCount(0);
  await page.getByRole("button", { name: "选择语言" }).click();
  await page.getByRole("menuitemradio", { name: "English" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Data");
  await page.goto("/collection", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Plans");
  await expect(page.getByLabel("Enable local digest notifications")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Help", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Choose language" }).click();
  await page.getByRole("menuitemradio", { name: "简体中文" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("计划");
  await expect(page.locator(".management-page .summary-grid > .panel > span")).toHaveText(["新增", "购买", "出售", "估值"]);
  await expect(page.getByText("当前没有待整理项目。", { exact: true })).toHaveCount(0);
  await page.goto("/settings", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "展开使用说明", exact: true }).click();
  await expect(page.getByRole("button", { name: "收起使用说明", exact: true })).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator("#plans")).toContainText("180 天");
  await expect(page.locator("#plans")).toContainText("不发送系统通知");
  await expect(page.locator(".user-guide-index a")).toHaveCount(9);
  await page.getByRole("button", { name: "选择语言" }).click();
  await page.getByRole("menuitemradio", { name: "English" }).click();
  await expect(page.getByRole("button", { name: "Collapse User guide", exact: true })).toHaveAttribute("aria-expanded", "true");
  expect(await page.locator(".user-guide-page").innerText()).not.toMatch(/[\u3400-\u9fff]/u);
  await page.getByRole("link", { name: "Detailed financial calculation rules" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Financial calculation rules");
});

test("incomplete portfolio data links to the affected card and preserves the filter", async ({ page }) => {
  await page.goto("/portfolio?q=卡片数量", { waitUntil: "networkidle" });
  const note = page.locator(".financial-incomplete");
  await expect(note.locator("summary")).toHaveText("财务待完善 · 1 张");
  await note.locator("summary").click();
  const link = note.getByRole("link", { name: "卡片数量 · 备注", exact: true });
  await expect(link).toBeVisible();
  await expect(note).toContainText("缺成本记录");
  await expect(note).toContainText("缺估值");
  await link.click();
  const url = new URL(page.url());
  expect(url.pathname).toBe("/cards/management-ui");
  expect(url.searchParams.get("returnTo")).toBe("/portfolio?q=%E5%8D%A1%E7%89%87%E6%95%B0%E9%87%8F");
});

test("Settings groups data management and fits the minimum Windows window", async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 760 });
  await page.goto("/settings", { waitUntil: "networkidle" });
  await expect(page.locator(".nav-links").getByRole("link", { name: "数据", exact: true })).toHaveCount(0);
  await expect(page.locator(".settings-page > .settings-section")).toHaveText(["数据", "AI", "财务", "使用说明", "关于v1.3.0"]);
  await page.getByRole("button", { name: "展开数据", exact: true }).click();
  await expect(page).toHaveURL(/settings$/);
  await expect(page.getByRole("heading", { name: "存储", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "备份与恢复", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "导入", exact: true })).toBeVisible();
  await expect(page.locator('.nav-links a.active')).toHaveText("设置");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await expect(page.getByRole("heading", { name: "最近批次", exact: true })).toHaveCount(0);
  await expect(page.locator(".selection-actions button")).toHaveText(["选中本页", "选择全部", "清空选择"]);
  await page.getByLabel("搜索收藏").fill("卡片数量");
  await page.getByRole("button", { name: "收起数据", exact: true }).click();
  await expect(page.getByLabel("搜索收藏")).toBeHidden();
  await page.getByRole("button", { name: "展开数据", exact: true }).click();
  await expect(page.getByLabel("搜索收藏")).toHaveValue("卡片数量");
  await page.goto("/data-center", { waitUntil: "networkidle" });
  await expect(page).toHaveURL(/settings\/data$/);
});

test("home and showcase view choices preserve cards, filters and page reloads", async ({ page }) => {
  for (const [url, container] of [["/?q=卡片数量", '[data-testid="home-card-grid"]'], ["/showcase?q=Jordan", ".showcase-views"]]) {
    await page.goto(url, { waitUntil: "networkidle" });
    const cards = page.locator(container);
    const links = await cards.locator("a").evaluateAll(items => items.map(item => item.getAttribute("href")));
    await page.getByRole("button", { name: "列表视图", exact: true }).click();
    await expect(cards).toHaveClass(/is-list/);
    expect(await cards.locator("a").evaluateAll(items => items.map(item => item.getAttribute("href")))).toEqual(links);
    await page.reload({ waitUntil: "networkidle" });
    await expect(cards).toHaveClass(/is-list/);
    expect(new URL(page.url()).searchParams.get("q")).toBeTruthy();
    await page.getByRole("button", { name: "卡片视图", exact: true }).click();
    await expect(cards).not.toHaveClass(/is-list/);
  }
});

test("view switching works when preference storage is blocked", async ({ page }) => {
  await page.addInitScript(() => { Storage.prototype.getItem = () => { throw new Error("blocked"); }; Storage.prototype.setItem = () => { throw new Error("blocked"); }; });
  await page.goto("/?q=卡片数量", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "列表视图", exact: true }).click();
  await expect(page.getByTestId("home-card-grid")).toHaveClass(/is-list/);
  await page.getByRole("button", { name: "卡片视图", exact: true }).click();
  await expect(page.getByTestId("home-card-grid")).not.toHaveClass(/is-list/);
});

for (const mode of ["list", "table"]) {
  test(`export ${mode} card info returns to the expanded data section with its state`, async ({ page }) => {
    fixture(db => { const insert = db.prepare("INSERT INTO Card(id,playerName,cardTitle,sport,tags) VALUES(?,?,?,'Basketball','')"); for (let i=0;i<26;i++) insert.run("export-return-"+i, "Import UI", "Return card "+i); });
    await page.goto("/settings", { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "展开数据", exact: true }).click();
    await page.getByLabel("搜索收藏").fill("Import UI");
    const pagination = page.getByRole("navigation", { name: "导出分页" });
    await expect(pagination.locator("span")).toHaveText("1 / 2");
    await pagination.getByRole("button", { name: "下一页" }).click();
    await expect(pagination.locator("span")).toHaveText("2 / 2");
    await page.getByRole("button", { name: mode === "table" ? "表格视图" : "列表视图", exact: true }).click();
    const rows = page.locator(mode === "table" ? "#data-export tbody tr" : ".management-card-option");
    await expect(rows).toHaveCount(2);
    await page.getByLabel("仅导出公开档案").check();
    await page.getByRole("button", { name: "选中本页", exact: true }).click();
    await expect(page.locator(".selection-actions > span")).toHaveText("2 / 26");
    const info = rows.first().locator("a").last();
    const destination = await info.getAttribute("href");
    await expect(page.locator("#data-export").getByRole("link", { name: "详情", exact: true })).toHaveCount(0);
    await info.click();
    await expect(page).toHaveURL(/\/cards\/export-return-/);
    const returnTo = new URL(page.url()).searchParams.get("returnTo");
    expect(returnTo).toContain("exportPage=1");
    expect(returnTo).toContain("#data-export");
    const back = page.getByRole("link", { name: "返回上一页", exact: true });
    await expect(back).toHaveAttribute("href", returnTo);
    await back.click();
    await expect(page).toHaveURL(/settings\?.*#data-export$/);
    await expect(page.getByRole("button", { name: "收起数据", exact: true })).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByLabel("搜索收藏")).toHaveValue("Import UI");
    await expect(pagination.locator("span")).toHaveText("2 / 2");
    await expect(page.getByLabel("仅导出公开档案")).toBeChecked();
    await expect(page.getByRole("button", { name: mode === "table" ? "表格视图" : "列表视图", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(rows).toHaveCount(2);
    await expect(rows.first().getByRole("checkbox")).toBeChecked();
    await expect(rows.last().getByRole("checkbox")).toBeChecked();
    await expect(rows.first().locator("a").last()).toHaveAttribute("href", destination);
    await page.reload({ waitUntil: "networkidle" });
    await expect(rows.first().getByRole("checkbox")).toBeChecked();
    await expect(page.getByLabel("搜索收藏")).toHaveValue("Import UI");
  });
}

test("wishlist input and display fold independently and editing opens the form", async ({ page }) => {
  await page.goto("/collection", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "心愿单", exact: true })).toBeVisible();
  const inputSection = page.locator(".wish-disclosure").first();
  const displaySection = page.locator(".wish-list");
  await expect(inputSection).not.toHaveAttribute("open", "");
  await expect(displaySection).toHaveAttribute("open", "");
  await inputSection.locator("summary").click();
  await page.getByLabel("心愿名称", { exact: true }).fill("UI wishlist");
  await displaySection.locator("summary").click();
  await expect(page.getByLabel("心愿名称", { exact: true })).toBeVisible();
  await inputSection.locator("summary").click();
  await inputSection.locator("summary").click();
  await expect(page.getByLabel("心愿名称", { exact: true })).toHaveValue("UI wishlist");
  await page.getByRole("button", { name: "添加心愿", exact: true }).click();
  await expect(inputSection).not.toHaveAttribute("open", "");
  await expect(displaySection).not.toHaveAttribute("open", "");
  await displaySection.locator("summary").click();
  await expect(displaySection.getByText("UI wishlist", { exact: true })).toBeVisible();
  await displaySection.getByRole("button", { name: "编辑", exact: true }).click();
  await expect(page.getByLabel("心愿名称", { exact: true })).toBeVisible();
  await expect(page.getByLabel("心愿名称", { exact: true })).toHaveValue("UI wishlist");
  await expect(inputSection.locator("summary")).toHaveText("编辑");
});

test("share inline actions keep equal fonts, alignment and targeted deletion", async ({ page }, testInfo) => {
  fixture(db => db.prepare("INSERT INTO ShareCollection(id,title,slug,theme) VALUES('more-actions-ui','Inline actions UI','more-actions-ui','classic')").run());
  await page.setViewportSize({ width: 1100, height: 760 });
  await page.goto("/shares", { waitUntil: "networkidle" });
  const share = page.locator(".share-list-item").filter({ hasText: "Inline actions UI" });
  const actions = share.locator(".share-list-actions .btn");
  await expect(actions).toHaveText(["预览", "编辑", "导出", "删除"]);
  await expect(share.getByRole("button", { name: "删除", exact: true })).toBeVisible();
  await expect(share.locator("details")).toHaveCount(0);
  const fonts = await actions.evaluateAll(elements => elements.map(element => { const style = getComputedStyle(element); return [style.fontFamily, style.fontSize, style.fontWeight, style.lineHeight].join("|"); }));
  expect(new Set(fonts).size).toBe(1);
  const bounds = await actions.evaluateAll(elements => elements.map(element => { const rect = element.getBoundingClientRect(); return { x: rect.x, y: rect.y, width: rect.width, height: rect.height }; }));
  for (const [index, rect] of bounds.entries()) {
    expect(rect.y).toBe(bounds[0].y);
    expect(rect.height).toBe(bounds[0].height);
    expect(rect.x).toBeGreaterThanOrEqual(index ? bounds[index - 1].x + bounds[index - 1].width : 0);
    expect(rect.x + rect.width).toBeLessThanOrEqual(1100);
  }
  await page.screenshot({ path: testInfo.outputPath("share-inline-actions.png"), fullPage: true });
  await page.getByRole("button", { name: "选择语言" }).click();
  await page.getByRole("menuitemradio", { name: "English" }).click();
  await expect(actions).toHaveText(["Preview", "Edit", "Export", "Delete"]);
  expect(await share.innerText()).not.toMatch(/[\u3400-\u9fff]/u);
  const deleteButton = share.getByRole("button", { name: "Delete", exact: true });
  await deleteButton.focus();
  await page.keyboard.press("Enter");
  await expect(share).toHaveCount(0);
  expect(fixture(db => db.prepare("SELECT COUNT(*) n FROM ShareCollection WHERE id='more-actions-ui'").get().n)).toBe(0);
  expect(fixture(db => db.prepare("SELECT COUNT(*) n FROM ShareCollection WHERE id='ui-share-1'").get().n)).toBe(1);
});
