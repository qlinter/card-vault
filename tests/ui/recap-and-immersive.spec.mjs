import { expect, test } from "@playwright/test";
import fs from "node:fs";
import { withUiDatabase as fixture } from "./database-fixture.mjs";

const spec = { year: 2026, basis: "purchase", scope: { q: "RecapFixture" } };
function seed() {
  fixture(db => {
    db.exec("DELETE FROM Card WHERE id LIKE 'recap-fixture-%'");
    const insert = db.prepare("INSERT INTO Card(id,playerName,cardTitle,sport,productLine,visibility,collectionStatus,holdingQuantity,isAutograph,grade,createdAt,notes) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)");
    insert.run("recap-fixture-a", "RecapFixture Alpha", "Recap Public", "Basketball", "Series A", "public", "sold", 0, 1, "10", "2026-08-01T00:00:00Z", "NEVER_EXPORT_PRIVATE_NOTES");
    insert.run("recap-fixture-b", "RecapFixture Beta", "Recap Private", "Football", "Series B", "private", "holding", 4, 0, null, new Date("2026-09-01Z").getTime(), "NEVER_EXPORT_PRIVATE_NOTES");
    insert.run("recap-fixture-c", "RecapFixture Missing", "Missing Purchase Date", "Football", "Series B", "public", "holding", 1, 0, null, "2026-09-01T00:00:00Z", "NEVER_EXPORT_PRIVATE_NOTES");
    const buy = db.prepare("INSERT INTO CardTransaction(id,cardId,kind,amountMinor,currency,quantity,occurredAt,provenance) VALUES(?,?,'purchase',12345,'CNY',?,?,'ui-test')");
    buy.run("recap-buy-1", "recap-fixture-a", 2, "2026-01-02T00:00:00Z"); buy.run("recap-buy-2", "recap-fixture-a", 3, new Date("2026-02-02Z").getTime()); buy.run("recap-buy-3", "recap-fixture-b", 4, "2026-03-02T00:00:00Z"); buy.run("recap-buy-old", "recap-fixture-a", 1, "2020-01-02T00:00:00Z");
    db.exec("INSERT INTO CardImage(id,cardId,path,rotation) VALUES('recap-img-a','recap-fixture-a','/media/ui-card-1.webp',90),('recap-img-a2','recap-fixture-a','/media/ui-card-2.webp',0),('recap-img-b','recap-fixture-b','/media/ui-card-2.webp',0)");
  });
}
test.beforeEach(seed);
test.afterEach(() => fixture(db => db.exec("DELETE FROM Card WHERE id LIKE 'recap-fixture-%'")));

test("recap filters switch automatically and retain collection scope", async ({ page }) => {
  await page.goto("/portfolio/recap?recapYear=2026&q=RecapFixture");
  await expect(page.locator(".recap-stats strong").first()).toHaveText("9");
  await expect(page.getByRole("button", { name: "保存", exact: true })).toHaveCount(0);
  await page.getByLabel("回顾口径", { exact: true }).selectOption("entry");
  await expect(page.locator(".recap-stats strong").first()).toHaveText("3");
  await page.getByLabel("月份", { exact: true }).selectOption("9");
  await expect(page.locator(".recap-stats strong").first()).toHaveText("2");
  await expect(page).toHaveURL(/q=RecapFixture/);
  await page.getByLabel("年份", { exact: true }).fill("2025");
  await expect(page.locator(".recap-stats strong").first()).toHaveText("0");
});

test("recap switches data without entrance animation or dimming while pending", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  await page.route("**/portfolio/recap?**", async route => {
    if (route.request().headers().rsc === "1" && new URL(route.request().url()).searchParams.get("recapMonth") === "1") await pending;
    await route.continue();
  });
  try {
    await page.goto("/portfolio/recap?recapYear=2026&q=RecapFixture");
    await expect(page.locator(".recap-page")).toHaveCSS("animation-name", "none");
    await page.getByLabel("月份", { exact: true }).selectOption("1");
    await expect(page.locator(".recap-filters")).toHaveAttribute("aria-busy", "true");
    await expect(page.locator(".recap-content")).toHaveCSS("opacity", "1");
    release();
    await expect(page.getByLabel("回顾标题", { exact: true })).toHaveValue("2026年1月收藏回顾");
    await expect(page.locator(".recap-page")).toHaveCSS("animation-name", "none");
  } finally { release(); }
});

for (const locale of ["zh-CN", "en"]) test(`recap privacy switch controls direct image download (${locale})`, async ({ page, context }) => {
  await context.addCookies([{ name: "card_vault_ui_locale", value: locale, url: "http://127.0.0.1:3360" }]);
  const l=(zh,en)=>locale==="en"?en:zh;
  await page.goto("/portfolio/recap?recapYear=2026&q=RecapFixture");
  const toggle=page.getByRole("switch", { name:l("包含私密卡片","Include Private Cards"), exact:true });
  await expect(toggle).toHaveAttribute("aria-checked","false");
  await expect(toggle).toHaveCSS("border-width", "0px");
  await expect(toggle).toHaveCSS("font-size", "13px");
  for(const quantity of ["5","9"]) {
    const downloadEvent=page.waitForEvent("download"), responseEvent=page.waitForResponse(response=>response.url().endsWith("/api/collection-recaps/export"));
    await page.getByRole("button",{name:l("生成长图","Generate Image"),exact:true}).click();
    expect((await responseEvent).headers()["x-recap-quantity"]).toBe(quantity);
    const download=await downloadEvent; expect(await download.failure()).toBeNull(); expect(fs.readFileSync(await download.path()).subarray(0,8).toString("hex")).toBe("89504e470d0a1a0a");
    if(quantity==="5") { await toggle.focus(); await page.keyboard.press("Space"); await expect(toggle).toHaveAttribute("aria-checked","true"); }
  }
});

test("monthly filters reset temporary curation and display weekly activity", async ({ page }) => {
  await page.goto("/portfolio/recap?recapYear=2026&q=RecapFixture");
  await page.getByLabel("回顾标题",{exact:true}).fill("Temporary title");
  await page.getByLabel("月份",{exact:true}).selectOption("1");
  await expect(page.getByLabel("回顾标题",{exact:true})).toHaveValue("2026年1月收藏回顾");
  await expect(page.locator(".recap-chart-column strong")).toHaveText(["2","0","0","0","0"]);
  await page.emulateMedia({reducedMotion:"reduce"}); await expect(page.locator(".recap-story")).toHaveScreenshot("recap-monthly.png");
  await page.getByLabel("月份",{exact:true}).selectOption("2");
  await page.getByLabel("月份",{exact:true}).selectOption("3");
  await expect(page.getByLabel("回顾标题",{exact:true})).toHaveValue("2026年3月收藏回顾");
  await expect(page.locator(".recap-stats strong").first()).toHaveText("4");
  await page.reload(); await expect(page.getByLabel("月份",{exact:true})).toHaveValue("3");
});

test("recap computes current data and exposes no persistence endpoints", async ({ page }) => {
  await page.goto("/portfolio/recap?id=recap-retired");
  await expect(page.locator(".recap-stats")).toBeVisible(); await expect(page.locator(".recap-saved-panel")).toHaveCount(0);
  fixture(db=>{ expect(db.prepare("SELECT COUNT(*) n FROM Card WHERE id LIKE 'recap-fixture-%'").get().n).toBe(3); });
  expect((await page.request.post("/api/collection-recaps",{data:{spec,title:"Retired",representativeIds:[]}})).status()).toBe(405);
  expect((await page.request.patch("/api/collection-recaps/recap-retired",{data:{title:"Retired"}})).status()).toBe(404);
});

test("representatives can be removed and added in the integrated picker", async ({ page }) => {
  await page.goto("/portfolio/recap?recapYear=2026&q=RecapFixture");
  await expect(page.locator(".recap-view-actions button")).toHaveText(["赏卡：本期全部", "赏卡：代表卡片", "卡片调整"]);
  await expect(page.locator(".recap-stats > div").first()).toHaveCSS("text-align", "center");
  await expect(page.getByRole("heading", { name: "导出回顾长图", exact: true })).toHaveCount(0);
  await expect(page.locator(".recap-story-header").getByRole("button", { name: "生成长图", exact: true })).toBeVisible();
  await expect(page.locator(".recap-representatives article")).toHaveCount(2);
  await expect(page.locator(".recap-picker")).toHaveCount(0);
  await page.locator(".recap-representatives article").first().getByRole("button", { name: "移除", exact: true }).click();
  await page.getByRole("button", { name: "卡片调整", exact: true }).click();
  await expect(page.locator(".recap-picker button")).toHaveCount(1);
  await page.locator(".recap-picker button").click();
  await expect(page.locator(".recap-representatives article")).toHaveCount(2);
  await expect(page.locator(".recap-picker button")).toHaveCount(0);
  await page.getByRole("button", { name: "卡片调整", exact: true }).click();
  await page.goto("/showcase/cards/recap-fixture-a");
  await expect(page.getByRole("button", { name: "浏览", exact: true })).toHaveCount(0);
});

test("statistics separates scope navigation, recap entry and overview analysis", async ({ page }) => {
  await page.goto("/portfolio?q=RecapFixture");
  await expect(page.locator('[id="portfolio-current-title"]').locator("..").getByRole("link", { name: "返回筛选结果", exact: true })).toBeVisible();
  const recap = page.getByRole("link", { name: "收藏回顾", exact: true });
  await expect(recap).toHaveAttribute("href", /q=RecapFixture/);
  const analysis = page.getByRole("button", { name: "组合分析", exact: true });
  await expect(analysis).toBeVisible();
  await expect(analysis).toHaveCSS("border-top-color", "rgba(0, 0, 0, 0)");
  const viewCards = page.getByRole("link", { name: "返回筛选结果", exact: true });
  const [viewBox, recapBox, analysisBox, headingBox] = await Promise.all([viewCards, recap, analysis, page.getByRole("heading", { name: "组合总览", exact: true })].map(item => item.boundingBox()));
  expect(Math.abs(viewBox.y - recapBox.y)).toBeLessThanOrEqual(1);
  expect(viewBox.x).toBeGreaterThan(recapBox.x);
  expect(analysisBox.x - (headingBox.x + headingBox.width)).toBeGreaterThanOrEqual(8);
  expect(analysisBox.x - (headingBox.x + headingBox.width)).toBeLessThanOrEqual(20);
  for (const action of [viewCards, recap, analysis]) { await expect(action).toHaveCSS("font-size", "13px"); await expect(action).toHaveCSS("min-height", "36px"); }
  await expect(page.locator("#portfolio-current-title")).toHaveCSS("font-size", "13px");
  await expect(page.locator("#portfolio-current-title")).toHaveCSS("font-weight", "400");
  await page.getByRole("link", { name: "趋势", exact: true }).click(); await expect(analysis).toHaveCount(0); await expect(recap).toBeVisible();
});

test("immersive viewer uses all matching cards beyond showcase pagination and preserves page position", async ({ page }) => {
  fixture(db => { const insert = db.prepare("INSERT INTO Card(id,playerName,cardTitle,sport) VALUES(?,?,?,'Basketball')"); for (let index = 0; index < 53; index++) insert.run(`recap-fixture-many-${index}`, "RecapFixture Many", `Viewer Card ${index}`); });
  await page.goto("/showcase?q=RecapFixture&page=2"); await page.evaluate(() => window.scrollTo(0, 140)); const before = await page.evaluate(() => scrollY), url = page.url();
  await page.getByRole("button", { name: "浏览", exact: true }).evaluate(button => button.click());
  const viewer = page.getByRole("dialog", { name: "沉浸式赏卡", exact: true }); await expect(viewer).toBeVisible(); await expect(viewer.locator(".gallery-position")).toContainText("056");
  await page.keyboard.press("Escape"); await expect(viewer).toHaveCount(0); expect(page.url()).toBe(url); expect(await page.evaluate(() => scrollY)).toBe(before);
});

test("immersive random history, image controls, pause on blur, temporary rotation and fullscreen escape", async ({ page }) => {
  await page.goto("/showcase?q=RecapFixture Alpha"); await page.getByRole("button", { name: "浏览", exact: true }).click();
  const viewer = page.getByRole("dialog", { name: "沉浸式赏卡", exact: true }), stage = viewer.locator(".immersive-stage");
  await expect(viewer.getByRole("button", { name: "播放", exact: true })).toBeEnabled();
  await page.keyboard.press("ArrowDown"); await expect(viewer.locator(".showcase-media-image")).toHaveAttribute("src", "/media/ui-card-2.webp");
  await page.keyboard.press("+"); await expect(viewer.getByRole("button", { name: "重置缩放", exact: true })).toHaveText("125%");
  await viewer.getByRole("button", { name: "旋转", exact: true }).click();
  await viewer.getByRole("button", { name: "播放", exact: true }).click(); await expect(stage).toHaveAttribute("data-playing", "true");
  await page.evaluate(() => window.dispatchEvent(new Event("blur"))); await expect(stage).toHaveAttribute("data-playing", "false");
  await viewer.getByRole("button", { name: "全屏", exact: true }).click(); await expect.poll(() => page.evaluate(() => Boolean(document.fullscreenElement))).toBe(true);
  await page.keyboard.press("Escape"); await expect.poll(() => page.evaluate(() => Boolean(document.fullscreenElement))).toBe(false); await expect(viewer).toBeVisible();
  await page.keyboard.press("Escape"); await expect(viewer).toHaveCount(0);
  fixture(db => expect(db.prepare("SELECT rotation FROM CardImage WHERE id='recap-img-a'").get().rotation).toBe(90));
  await page.goto("/showcase?q=RecapFixture"); await page.getByRole("button", { name: "浏览", exact: true }).click();
  await viewer.getByRole("button", { name: "展馆设置", exact: true }).click();
  await viewer.getByLabel("播放顺序", { exact: true }).selectOption("random");
  await viewer.getByRole("button", { name: "关闭设置", exact: true }).click();
  const history = []; for (let i = 0; i < 3; i++) { await expect(stage).toHaveAttribute("data-card-id", /recap-fixture-/); history.push(await stage.getAttribute("data-card-id")); if (i < 2) await page.keyboard.press("ArrowRight"); }
  expect(new Set(history).size).toBe(3); await page.keyboard.press("ArrowLeft"); await expect(stage).toHaveAttribute("data-card-id", history[1]);
});

test("immersive failures stay recoverable and interval starts after load, not before", async ({ page }) => {
  await page.goto("/showcase?q=RecapFixture Alpha"); await page.getByRole("button", { name: "浏览", exact: true }).click();
  const viewer = page.getByRole("dialog", { name: "沉浸式赏卡", exact: true }); await expect(viewer.getByRole("button", { name: "播放", exact: true })).toBeEnabled();
  await viewer.getByRole("button", { name: "展馆设置", exact: true }).click();
  await viewer.getByRole("spinbutton", { name: "间隔（秒）", exact: true }).fill("5"); await viewer.getByRole("combobox", { name: "播放模式", exact: true }).selectOption("all");
  await viewer.getByRole("button", { name: "关闭设置", exact: true }).click();
  await viewer.getByRole("button", { name: "播放", exact: true }).click();
  await expect(viewer.locator(".showcase-media-image")).toHaveAttribute("src", "/media/ui-card-2.webp", { timeout: 8000 });
  await page.keyboard.press("Escape");
  await page.goto("/showcase?q=RecapFixture Missing"); await page.getByRole("button", { name: "浏览", exact: true }).click();
  await expect(viewer.getByText("当前范围的图片均不可用。可重试或退出赏卡。", { exact: true })).toBeVisible(); await expect(viewer.getByRole("button", { name: "播放", exact: true })).toBeDisabled();
  await viewer.getByRole("button", { name: "重试", exact: true }).click(); await expect(viewer).toBeVisible(); await page.keyboard.press("Escape");
});

test("immersive index is bounded across 500-card batches and deleted active cards can be skipped", async ({ page }) => {
  fixture(db => { const insert = db.prepare("INSERT INTO Card(id,playerName,cardTitle,sport) VALUES(?,?,?,'Basketball')"); for (let index = 0; index < 503; index++) insert.run(`recap-fixture-batch-${String(index).padStart(4, "0")}`, "SessionFixture", `Batch Card ${index}`); });
  const first = await (await page.request.get("/api/immersive?q=SessionFixture")).json(); expect(first.ids).toHaveLength(500); expect(first.nextCursor).toBeTruthy(); expect(JSON.stringify(first)).not.toContain("images");
  const second = await (await page.request.get(`/api/immersive?q=SessionFixture&cursor=${first.nextCursor}`)).json(); expect(second.ids).toHaveLength(3); expect(second.nextCursor).toBeNull(); expect(new Set([...first.ids, ...second.ids]).size).toBe(503);
  await page.goto("/showcase?q=RecapFixture"); await page.getByRole("button", { name: "浏览", exact: true }).click(); const stage = page.locator(".immersive-stage"); await expect(stage).toHaveAttribute("data-card-id", "recap-fixture-a");
  fixture(db => db.exec("DELETE FROM Card WHERE id='recap-fixture-b'")); await page.keyboard.press("ArrowRight");
  await expect(page.getByText("卡片已删除或不在当前范围。", { exact: true })).toBeVisible(); await page.getByRole("button", { name: "跳过", exact: true }).click(); await expect(stage).toHaveAttribute("data-card-id", "recap-fixture-c");
});

test("sequential viewing order matches Showcase", async ({ page }) => {
  fixture(db => {
    db.exec("INSERT INTO Card(id,playerName,cardTitle,sport) VALUES('recap-fixture-0','RecapFixture Zulu','Last subject','Basketball')");
  });
  await page.goto("/portfolio/recap?recapYear=2026&q=RecapFixture");
  const list = await (await page.request.get("/api/immersive?q=RecapFixture")).json();
  expect(list.ids).toEqual(["recap-fixture-a", "recap-fixture-b", "recap-fixture-c", "recap-fixture-0"]);
});
