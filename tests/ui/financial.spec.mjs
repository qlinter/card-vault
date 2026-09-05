import { expect, test } from "@playwright/test";
import { DatabaseSync } from "node:sqlite";
import path from "node:path";

// This database belongs exclusively to start-ui-test-server.js.
function fixtureDb(action) {
  const db = new DatabaseSync(path.resolve("tests/.ui-test-runtime/data/dev.db"));
  try { db.exec("PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000"); return action(db); } finally { db.close(); }
}

test.beforeEach(() => fixtureDb((db) => {
  db.exec("DELETE FROM ExchangeRate; DELETE FROM FinancialSettings;");
  db.prepare("INSERT INTO Card (id, playerName, cardTitle, sport, holdingQuantity) VALUES ('finance-ui', 'Finance Player', 'Mixed Payment', 'Basketball', 0)").run();
}));
test.afterEach(() => fixtureDb((db) => {
  db.prepare("DELETE FROM Card WHERE id='finance-ui'").run();
  db.exec("DELETE FROM ExchangeRate; DELETE FROM FinancialSettings;");
}));

async function openComposer(page, type, navigate = true) {
  if (navigate) await page.goto("/cards/finance-ui", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "＋ 新增记录", exact: true }).click();
  await page.getByRole("tab", { name: type, exact: true }).click();
  return page.locator("#financial-add-record form:visible");
}

test("consecutive transactions without a page reload receive different submission identifiers", async ({ page }) => {
  for (const count of [1, 2]) {
    const form = await openComposer(page, "交易", count === 1);
    await form.locator('[name="amount"]').fill("10");
    await form.locator('[name="occurredAt"]').fill("2026-01-01");
    await form.getByRole("button", { name: "保存交易" }).click();
    await expect(page.locator(".financial-key-metrics > div").first()).toContainText(`${count} 张`);
  }
  const rows = fixtureDb((db) => db.prepare("SELECT externalKey FROM CardTransaction WHERE cardId='finance-ui'").all());
  expect(rows).toHaveLength(2);
  expect(rows[0].externalKey).toBeTruthy();
  expect(rows[0].externalKey).not.toBe(rows[1].externalKey);
});
async function saveRate(page, rate = "7") {
  await page.goto("/settings", { waitUntil: "networkidle" });
  const settings = page.locator("#financial-settings");
  await settings.getByRole("button", { name: "展开财务" }).click();
  await settings.locator('[name="rate"]').fill(rate);
  await settings.locator('[name="effectiveDate"]').fill("2026-01-01");
  await settings.locator('[name="source"]').fill("UI manual reference");
  await settings.getByRole("button", { name: "保存汇率" }).click();
  await expect(settings.getByRole("status")).toHaveText("已保存。");
  return settings;
}

test("financial settings separate primary currency and support optional notes, editing and deleting rates", async ({ page }, testInfo) => {
  await page.goto("/settings");
  const settings = page.locator("#financial-settings");
  await expect(settings.locator("form")).toHaveCount(0);
  await settings.getByRole("button", { name: "展开财务" }).click();
  const create = settings.locator(".financial-settings-body > .exchange-rate-form");
  await create.locator('[name="rate"]').fill("0");
  await create.locator('[name="effectiveDate"]').fill("2026-01-01");
  await create.getByRole("button", { name: "保存汇率" }).click();
  await expect(create.getByRole("alert")).toContainText("汇率必须大于零");
  await create.locator('[name="rate"]').fill("7");
  await create.getByRole("button", { name: "保存汇率" }).click();
  await expect(create.getByRole("status")).toHaveText("已保存。");
  expect(fixtureDb(db => db.prepare("SELECT source FROM ExchangeRate").get().source)).toBe("");
  const primary = settings.locator(".primary-currency-form");
  await primary.locator('[name="reportingCurrency"]').selectOption("USD");
  await primary.getByRole("button", { name: "保存主币种" }).click();
  await expect(primary.getByRole("status")).toHaveText("已保存。");
  expect(fixtureDb(db => db.prepare("SELECT COUNT(*) AS count FROM ExchangeRate").get().count)).toBe(1);
  await page.reload({ waitUntil: "networkidle" });
  await settings.getByRole("button", { name: "展开财务" }).click();
  await expect(primary.locator('[name="reportingCurrency"]')).toHaveValue("USD");
  await settings.locator("summary").click();
  const row = settings.locator(".exchange-rate-row");
  await row.getByRole("button", { name: "编辑", exact: true }).click();
  const editor = row.locator(".exchange-rate-form");
  await editor.locator('[name="rate"]').fill("7.1");
  await editor.locator('[name="effectiveDate"]').fill("2025-12-01");
  await editor.getByRole("button", { name: "保存修改" }).click();
  await expect(editor.getByRole("status")).toHaveText("已保存。");
  await expect(row.locator(".exchange-rate-summary")).toContainText("2025-12-01");
  await expect(row.locator(".exchange-rate-summary")).toContainText("7.1 CNY");
  await expect(settings).not.toContainText("使用中");
  await testInfo.attach("financial-settings-expanded", { body: await settings.screenshot(), contentType: "image/png" });
  expect(fixtureDb(db => db.prepare("SELECT effectiveDate, rateMicros, source FROM ExchangeRate").all())).toEqual([{ effectiveDate: "2025-12-01", rateMicros: 7100000, source: "" }]);
  await row.getByRole("button", { name: "删除", exact: true }).click();
  await expect(row).toHaveCount(0);
  expect(fixtureDb(db => db.prepare("SELECT COUNT(*) AS count FROM ExchangeRate").get().count)).toBe(0);
  expect(fixtureDb(db => db.prepare("SELECT reportingCurrency FROM FinancialSettings WHERE id='default'").get().reportingCurrency)).toBe("USD");
});

test("mixed payment and cross-currency sale share one holding and one reporting value", async ({ page }, testInfo) => {
  let form = await openComposer(page, "交易");
  await form.locator('[name="amount"]').fill("100");
  await form.locator('[name="secondaryAmount"]').fill("100");
  await form.locator('[name="quantity"]').fill("2");
  await form.locator('[name="occurredAt"]').fill("2026-01-01");
  await form.getByRole("button", { name: "保存交易" }).click();
  await expect(page.locator(".financial-timeline")).toContainText("持仓 +2 张");
  expect(fixtureDb(db => db.prepare("SELECT holdingQuantity FROM Card WHERE id='finance-ui'").get().holdingQuantity)).toBe(2);
  await expect(page.locator(".financial-overview")).not.toContainText("统一持仓");
  await expect(page.locator(".financial-overview")).not.toContainText("使用的汇率依据");
  await saveRate(page);

  form = await openComposer(page, "交易");
  await form.locator('[name="kind"]').selectOption("sale");
  await form.locator('[name="currency"]').selectOption("USD");
  await form.locator('[name="amount"]').fill("100");
  await form.locator('[name="quantity"]').fill("1");
  await form.locator('[name="occurredAt"]').fill("2026-02-01");
  await form.getByRole("button", { name: "保存交易" }).click();
  await expect(page.locator(".financial-key-metrics > div").first()).toContainText("1 张");

  form = await openComposer(page, "费用");
  await form.locator('[name="context"]').selectOption("sale");
  await form.locator('[name="amount"]').fill("10");
  await form.locator('[name="occurredAt"]').fill("2026-02-01");
  const saleId = fixtureDb((db) => db.prepare("SELECT id FROM CardTransaction WHERE cardId='finance-ui' AND kind='sale'").get().id);
  await form.locator('[name="transactionId"]').selectOption(saleId);
  await form.getByRole("button", { name: "保存费用" }).click();
  await expect(page.locator(".financial-overview")).toContainText("+CNY 290.00");

  for (const [currency, amount, day] of [["CNY", "500", "2026-02-02"], ["USD", "80", "2026-02-03"]]) {
    form = await openComposer(page, "估值");
    await form.locator('[name="currency"]').selectOption(currency);
    await form.locator('[name="amount"]').fill(amount);
    await form.locator('[name="valuedAt"]').fill(day);
    await form.getByRole("button", { name: "保存估值" }).click();
    await expect(page.locator(".financial-overview")).toContainText("CNY 500.00");
  }
  await expect(page.locator(".financial-overview")).toContainText("+CNY 390.00");
  await testInfo.attach("unified-finance", { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
  await page.goto("/?q=Finance%20Player");
  await expect(page.locator(".valuation-total-list")).toContainText("CNY 500.00");
  await page.goto("/portfolio?q=Finance%20Player");
  await expect(page.locator(".portfolio-page")).toContainText("CNY +390.00");
  const financial = page.getByRole("heading", { name: "持仓财务", exact: true }).locator("xpath=ancestor::section[1]");
  await expect(financial).not.toContainText("本次使用的汇率");
  await expect(financial.locator("dt")).toHaveText(["累计买入金额", "累计费用", "净现金投入", "累计出售金额", "剩余成本", "已实现盈亏", "总盈亏", "未实现盈亏", "未实现回报率"]);
  for (const heading of ["财务历史趋势", "活动趋势"]) {
    const section = page.getByRole("heading", { name: heading, exact: true }).locator("xpath=ancestor::section[1]");
    for (const range of ["12", "24", "all"]) {
      await section.getByRole("combobox").selectOption(range);
      await expect(section.locator("svg text").filter({ hasText: "2026-01" })).toHaveCount(1);
      await expect(section.locator('[data-horizontal-scroll]')).toHaveAttribute("data-horizontal-scroll", "disabled");
    }
    const widths = await section.locator('[data-horizontal-scroll]').evaluate(element => ({ container: element.clientWidth, svg: element.querySelector('svg').getBoundingClientRect().width }));
    expect(Math.abs(widths.container - widths.svg)).toBeLessThan(2);
  }
  const activity = page.getByRole("heading", { name: "活动趋势", exact: true }).locator("xpath=ancestor::section[1]");
  await activity.getByRole("button", { name: "2026-01 月度数据" }).click();
  await expect(activity.getByRole("status")).toContainText("2 张");
  await activity.getByRole("button", { name: "2026-02 月度数据" }).focus();
  await expect(activity.getByRole("status")).toContainText("1 张");
  await expect(activity).not.toContainText("评级");
  await testInfo.attach("portfolio-full-width-trends", { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
});

test("Finance links to clear calculation rules and returns to its expanded section", async ({ page }) => {
  await page.goto("/settings", { waitUntil: "networkidle" });
  await expect(page.getByRole("button", { name: "展开 AI", exact: true })).toHaveText("AI");
  await page.getByRole("button", { name: "展开财务", exact: true }).click();
  await page.getByRole("link", { name: "查看财务计算规则 →" }).click();
  await expect(page).toHaveURL(/settings\/finance-rules$/);
  await expect(page.getByRole("heading", { name: "财务计算规则", exact: true })).toBeVisible();
  await expect(page.locator(".finance-rules-page")).toContainText("移动平均法");
  await expect(page.getByRole("heading", { name: "8. 一个例子", exact: true })).toBeVisible();
  await expect(page.locator(".finance-rules-page")).toContainText("部分持仓有估值");
  await page.getByRole("link", { name: "返回财务", exact: true }).click();
  await expect(page.getByRole("button", { name: "收起财务", exact: true })).toHaveAttribute("aria-expanded", "true");
});
