import { withUiDatabase as database } from './database-fixture.mjs';
import { test, expect } from "@playwright/test";
test.beforeEach(() => database(db => {
  db.exec("BEGIN");
  for (let index = 0; index < 45; index++) {
    const id = `data-ui-${String(index).padStart(2, "0")}`;
    db.prepare("INSERT INTO Card(id,playerName,cardTitle,sport,team,brand,collectionStatus,holdingQuantity,createdAt) VALUES(?,'Data UI','Identical card','Basketball','A&B / 队','DataBrand',?,2,'2026-01-01T00:00:00.000Z')").run(id, index % 7 === 0 ? "listed" : "holding");
    db.prepare("INSERT INTO CardTransaction(id,cardId,kind,quantity,amountMinor,currency,occurredAt,amountKnown,provenance) VALUES(?,?,'purchase',2,10000,'CNY','2026-01-01T00:00:00.000Z',?,'ui-test')").run(id + "-buy", id, index === 44 ? 0 : 1);
    if (index !== 44) db.prepare("INSERT INTO CardValuation(id,cardId,amountMinor,currency,valuedAt,source,provenance) VALUES(?,?,8000,'CNY','2026-02-01T00:00:00.000Z','个人估计','ui-test')").run(id + "-quote", id);
  }
  db.exec("COMMIT");
}));
test.afterEach(() => database(db => { db.exec("DELETE FROM Card WHERE id LIKE 'data-ui-%'; DELETE FROM PortfolioSavedView WHERE name LIKE 'Data UI%'; DELETE FROM PortfolioSnapshotRecord WHERE name LIKE 'Data UI%';"); }));
const scoped = "/portfolio?q=Data+UI&team=A%26B+%2F+%E9%98%9F";

for (const locale of ["zh", "en"]) test(`data tabs retain scope, count physical copies and open exact duplicate archives (${locale})`, async ({ page, context }, testInfo) => {
  if (locale === "en") await context.addCookies([{ name: "card_vault_ui_locale", value: "en", url: "http://127.0.0.1:3360" }]);
  await page.goto(scoped, { waitUntil: "networkidle" });
  const labels = locale === "en" ? ["Overview", "Trends", "Structure", "Details"] : ["总览", "趋势", "结构", "明细"];
  await expect(page.locator('nav[aria-label="data sections"] a')).toHaveText(labels);
  await expect(page.getByTestId("data-counts")).toContainText("45");
  await expect(page.getByTestId("data-counts")).toContainText("90");
  for (const width of [1100, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const metrics = page.locator('[aria-label="financial summary"] article strong');
    await expect(metrics).toHaveCount(4);
    const geometry = await metrics.evaluateAll(elements => elements.map(element => ({ top: element.getBoundingClientRect().top, width: element.clientWidth, scroll: element.scrollWidth })));
    expect(Math.max(...geometry.map(item => item.top)) - Math.min(...geometry.map(item => item.top))).toBeLessThan(2);
    for (const item of geometry) expect(item.scroll).toBeLessThanOrEqual(item.width + 1);
  }
  await page.screenshot({ path: testInfo.outputPath(`data-overview-${locale}.png`), fullPage: true });
  const financialDisclosure = page.getByText(locale === "en" ? "Financial details and accounting basis" : "财务明细与核算依据", { exact: true });
  await financialDisclosure.click();
  const reportNote = page.locator(".financial-report-basis");
  await expect(reportNote).toBeVisible();
  expect(await reportNote.evaluate(note => parseFloat(getComputedStyle(note).fontSize))).toBeLessThanOrEqual(13);
  const incompleteLink = page.getByRole("link", { name: /^(财务待完善|Financial data incomplete)/ });
  expect(await incompleteLink.evaluate(link => getComputedStyle(link).fontSize)).toBe(await reportNote.evaluate(note => getComputedStyle(note).fontSize));
  await expect(reportNote.getByRole("link")).toHaveAttribute("href", "/settings#financial-settings");
  await page.screenshot({ path: testInfo.outputPath(`data-overview-expanded-${locale}.png`), fullPage: true });
  await financialDisclosure.click();
  const topLink = page.locator('a[href^="/cards/data-ui-00?"]');
  await expect(topLink).toHaveCount(1);
  await topLink.click();
  await expect(page).toHaveURL(/\/cards\/data-ui-00\?/);
  await page.getByRole("link", { name: locale === "en" ? "Back" : "返回上一页", exact: true }).click();
  await page.getByRole("link", { name: labels[3], exact: true }).click();
  await expect(page.getByTestId("data-details").locator("nav").first().getByRole("link")).toHaveText(locale === "en" ? ["List", "Review"] : ["列表", "整理"]);
  expect(new URL(page.url()).searchParams.get("team")).toBe("A&B / 队");
  await expect(page.getByTestId("data-details").locator("tbody tr")).toHaveCount(20);
  await page.getByRole("link", { name: locale === "en" ? "Next" : "下一页", exact: true }).click();
  await page.waitForURL(url => url.searchParams.get("page") === "2");
  await expect(page.getByTestId("data-details").locator('a[href^="/cards/data-ui-20?"]')).toBeVisible();
  await expect(page.getByTestId("data-details").locator("tbody tr")).toHaveCount(20);
  await page.getByRole("link", { name: locale === "en" ? "Next" : "下一页", exact: true }).click();
  await expect(page.getByTestId("data-details").locator("tbody tr")).toHaveCount(5);
  await page.reload({ waitUntil: "networkidle" });
  expect(new URL(page.url()).searchParams.get("page")).toBe("3");
});

test("structure measures and drill-through preserve the scope and precise dimension", async ({ page }, testInfo) => {
  await page.goto(scoped + "&tab=structure", { waitUntil: "networkidle" });
  await page.getByLabel("收藏结构维度").selectOption("team");
  await expect(page.getByLabel("结构统计口径")).toHaveCount(0);
  await page.getByRole("button", { name: "应用", exact: true }).click();
  const row = page.locator("tbody tr").filter({ has: page.getByRole("link", { name: "A&B / 队", exact: true }) });
  await expect(row).toContainText("90");
  await expect(page.getByRole("columnheader", { name: "估值占比", exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("data-structure.png"), fullPage: true });
  await row.getByRole("link", { name: "A&B / 队", exact: true }).click();
  await page.waitForURL(url => url.searchParams.get("dimension") === "team");
  expect(new URL(page.url()).searchParams.get("dimension")).toBe("team");
  expect(new URL(page.url()).searchParams.get("q")).toBe("Data UI");
  await expect(page.getByTestId("data-details").locator("tbody tr")).toHaveCount(20);
});

test("structure attributes include closed archives without adding them to holdings values", async ({ page }, testInfo) => {
  database(db => {
    db.exec("UPDATE Card SET isRookie=1 WHERE id IN ('data-ui-00','data-ui-01'); UPDATE Card SET collectionStatus='sold',holdingQuantity=0 WHERE id='data-ui-00';");
    for (let index = 0; index < 8; index++) db.prepare("UPDATE Card SET brand=? WHERE id=?").run(`Structure ${index}`, `data-ui-${String(index).padStart(2, "0")}`);
    db.prepare("INSERT INTO CardTransaction(id,cardId,kind,quantity,amountMinor,currency,occurredAt,amountKnown,provenance) VALUES('data-ui-00-sell','data-ui-00','sale',2,20000,'CNY','2026-02-02T00:00:00.000Z',1,'ui-test')").run();
  });
  await page.goto(scoped + "&tab=structure&structure=brand", { waitUntil: "networkidle" });
  const structure = page.getByTestId("data-structure");
  await expect(structure).not.toContainText("档案数量含已售，估值占比按已估值持仓计算。");
  await expect(structure).not.toContainText("HHI");
  const topShares = ["Top 1 · 83.72%", "Top 3 · 88.37%", "Top 5 · 93.02%"];
  const shareTops = [];
  for (const text of topShares) {
    const item = structure.getByText(text, { exact: true });
    await expect(item).toBeVisible();
    shareTops.push((await item.boundingBox()).y);
  }
  expect(Math.max(...shareTops) - Math.min(...shareTops)).toBeLessThan(2);
  await expect(structure.locator("tbody tr:visible")).toHaveCount(5);
  await structure.locator("summary").click();
  await expect(structure.locator("tbody tr:visible")).toHaveCount(9);
  const collapseBox = await structure.locator("summary").boundingBox();
  const lastRowBox = await structure.locator("tbody tr:visible").last().boundingBox();
  expect(collapseBox.y).toBeGreaterThanOrEqual(lastRowBox.y + lastRowBox.height);
  await expect(structure.locator("summary")).toHaveText("收起", { useInnerText: true });
  await page.screenshot({ path: testInfo.outputPath("data-structure-expanded.png"), fullPage: true });
  await structure.locator("summary").click();
  await expect(structure.locator("tbody tr:visible")).toHaveCount(5);
  await page.getByRole("button", { name: "卡片属性", exact: true }).click();
  await expect(page.getByRole("button", { name: "卡片属性", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByLabel("结构统计口径")).toHaveCount(0);
  const row = page.locator("tbody tr").filter({ has: page.getByRole("link", { name: "新秀卡", exact: true }) });
  await expect(row.locator("td").nth(1)).toHaveText("2已售 1 项");
  await expect(row.locator("td").nth(2)).toHaveText("2");
  await expect(row.locator("td").nth(3)).toContainText("160.00");
  await expect(row.locator("td").nth(4)).toHaveText("2.3%");
  const numericTops = await row.locator("td").evaluateAll(cells => cells.slice(1).map(cell => {
    const range = document.createRange();
    range.selectNodeContents(cell.firstElementChild || cell);
    return range.getClientRects()[0].top;
  }));
  expect(Math.max(...numericTops) - Math.min(...numericTops)).toBeLessThan(2);
  const soldFont = await row.getByRole("link", { name: "已售 1 项", exact: true }).evaluate(link => ({ note: getComputedStyle(link).fontSize, cell: getComputedStyle(link.parentElement).fontSize }));
  expect(soldFont.note).toBe(soldFont.cell);
  await page.screenshot({ path: testInfo.outputPath("data-attributes.png"), fullPage: true });
  await row.getByRole("link", { name: "已售 1 项", exact: true }).click();
  await expect(page.getByTestId("data-details").locator("tbody tr")).toHaveCount(1);
  await expect(page.getByTestId("data-details").locator('a[href^="/cards/data-ui-00?"]')).toBeVisible();
  expect(new URL(page.url()).searchParams.get("closed")).toBe("1");
  expect(new URL(page.url()).searchParams.get("isRookie")).toBe("true");
  await page.getByRole("link", { name: "总览", exact: true }).click();
  await page.getByRole("link", { name: "查看全部", exact: true }).click();
  await expect(page.getByTestId("data-details").locator("tbody tr")).toHaveCount(1);
  await expect(page.getByTestId("data-details").locator('a[href^="/cards/data-ui-01?"]')).toBeVisible();
  expect(new URL(page.url()).searchParams.has("closed")).toBe(false);
});

test("Review shows all records without search and editing returns to the complete list", async ({ page }) => {
  database(db => db.prepare("INSERT INTO CardImage(id,cardId,path) VALUES('data-ui-edit-image','data-ui-44','/media/ui-card-1.webp')").run());
  await page.goto(scoped + "&tab=details&kind=quality&issue=missing_cost", { waitUntil: "networkidle" });
  await expect(page.getByTestId("data-details").locator("tbody tr")).toHaveCount(45);
  await expect(page.getByTestId("data-details").locator('input[type="search"], form')).toHaveCount(0);
  await page.getByTestId("data-details").locator('a[href^="/cards/data-ui-44?"]').click();
  await page.locator(".title-row").getByRole("link", { name: "编辑", exact: true }).click();
  await page.getByRole("button", { name: "保存修改", exact: true }).click();
  await page.waitForURL(/success=updated/);
  await page.getByRole("link", { name: "返回上一页", exact: true }).click();
  await expect(page.getByTestId("data-details")).toBeVisible();
  await expect(page.getByTestId("data-details").locator('input[name="issue"], input[type="search"]')).toHaveCount(0);
  await expect(page.getByTestId("data-details").locator("tbody tr")).toHaveCount(45);
});

test("trend range, series switches and data tables preserve explicit missing baselines", async ({ page }, testInfo) => {
  await page.goto(scoped + "&tab=trends", { waitUntil: "networkidle" });
  await page.getByLabel("财务趋势时间范围").selectOption("6");
  await expect(page.getByLabel("活动趋势时间范围")).toHaveValue("12");
  await page.getByLabel("活动趋势时间范围").selectOption("all");
  await expect(page.getByLabel("财务趋势时间范围")).toHaveValue("6");
  const chart = page.locator("section").filter({ has: page.getByRole("heading", { name: "财务趋势", exact: true }) });
  await chart.getByRole("button", { name: "组合估值", exact: true }).click();
  await expect(chart.getByRole("button", { name: "组合估值", exact: true })).toHaveAttribute("aria-pressed", "false");
  await chart.getByText("查看数据表", { exact: true }).click();
  await expect(chart.locator("table tbody tr")).toHaveCount(6);
  const activity = page.locator("section").filter({ has: page.getByRole("heading", { name: "活动趋势", exact: true }) });
  await activity.getByRole("button", { name: "数量", exact: true }).click();
  await expect(activity.getByRole("heading", { name: "数量（张）", exact: true })).toBeVisible();
  await expect(activity.getByRole("button", { name: "费用", exact: true })).toHaveCount(0);
  await activity.getByRole("button", { name: "金额", exact: true }).click();
  await expect(activity.getByRole("button", { name: "费用", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "总览", exact: true }).click();
  await page.getByRole("link", { name: "趋势", exact: true }).click();
  await expect(page.getByLabel("财务趋势时间范围")).toHaveValue("6");
  await expect(page.getByLabel("活动趋势时间范围")).toHaveValue("all");
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.getByLabel("财务趋势时间范围")).toHaveValue("6");
  await expect(page.getByLabel("活动趋势时间范围")).toHaveValue("all");
  await page.screenshot({ path: testInfo.outputPath("data-trends.png"), fullPage: true });
});

for (const theme of ["gallery", "midnight", "archive"]) test(`compact collection and data summaries align in the ${theme} theme`, async ({ page, context }, testInfo) => {
  await context.addCookies([{ name: "card_vault_app_theme", value: theme, url: "http://127.0.0.1:3360" }]);
  await page.setViewportSize({ width: 1100, height: 900 });
  await page.goto("/?q=Data+UI", { waitUntil: "networkidle" });
  await expect(page.locator(".collection-summary")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath(`collection-${theme}.png`) });
  await page.goto(scoped, { waitUntil: "networkidle" });
  const period = page.getByRole("combobox", { name: "统计周期", exact: true });
  await period.selectOption("monthly");
  await expect(period).toBeEnabled();
  await expect(page.getByText("已保存。", { exact: true })).toHaveCount(0);
  await period.selectOption("weekly");
  await expect(period).toBeEnabled();
  await page.getByRole("link", { name: /待完善数据/ }).click();
  const toggle = page.locator(".collection-follow-up-toggle");
  await toggle.click();
  await expect(page.getByRole("checkbox", { name: "显示已处理", exact: true })).toBeVisible();
  await page.getByRole("checkbox", { name: "显示已处理", exact: true }).check();
  await toggle.click();
  await expect(page.locator(".collection-follow-up > section")).toHaveCount(0);
  await toggle.click();
  await expect(page.getByRole("checkbox", { name: "显示已处理", exact: true })).not.toBeChecked();
  await expect(page.locator("html")).toHaveAttribute("data-app-theme", theme);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath(`review-${theme}.png`), fullPage: true });
});

test("slow tab navigation retains current data and delays its progress hint", async ({ page }) => {
  await page.goto(scoped, { waitUntil: "networkidle" });
  await expect(page.getByTestId("data-counts")).toBeVisible();
  await page.clock.install();
  await page.clock.pauseAt(new Date());
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  await page.route(url => url.pathname === "/portfolio" && url.searchParams.get("tab") === "trends", async route => { await gate; await route.continue(); });
  try {
    await page.getByRole("link", { name: "趋势", exact: true }).click();
    await page.clock.runFor(399);
    await expect(page.getByTestId("data-counts")).toBeVisible();
    await expect(page.locator('nav[aria-label="data sections"]').getByRole("status")).toHaveCount(0);
    await page.clock.runFor(1);
    await expect(page.locator('nav[aria-label="data sections"]').getByRole("status")).toBeVisible();
    await expect(page.getByTestId("data-counts")).toBeVisible();
  } finally { release(); await page.clock.resume(); }
  await expect(page.getByTestId("data-trends")).toBeVisible();
});
