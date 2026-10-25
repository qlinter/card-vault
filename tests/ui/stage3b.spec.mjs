import { withUiDatabase as fixture } from './database-fixture.mjs';
import { expect, test } from "@playwright/test";
import reset from '../../scripts/reset-portfolio-history.js';
import { uiDatabasePath } from './database-fixture.mjs';
test.beforeEach(() => { fixture(db => {
  db.exec("PRAGMA user_version=1500301; INSERT INTO CollectionPlan(id,title,notes) VALUES('stage3b-wish','3B preserved wish','New simple wish'); INSERT INTO PortfolioSavedView(id,name,queryJson) VALUES('stage3b-view','3B old view','invalid'); INSERT INTO PortfolioSnapshotRecord(id,savedViewId,name,queryJson,snapshotJson) VALUES('stage3b-snapshot','stage3b-view','3B old snapshot','invalid','damaged')");
}); reset.resetPortfolioHistory(uiDatabasePath); });
test.afterEach(() => fixture(db => db.exec("DELETE FROM CollectionPlan WHERE id='stage3b-wish'; DELETE FROM PortfolioSnapshotRecord WHERE id='stage3b-snapshot'; DELETE FROM PortfolioSavedView WHERE id='stage3b-view'")));

for (const locale of ["zh","en"]) test("Data removes history and duplicate search while retaining inherited scope and AI analysis ("+locale+")", async ({ page,context }) => {
  if(locale==="en") await context.addCookies([{name:"card_vault_ui_locale",value:"en",url:"http://127.0.0.1:3360"}]);
  await page.route("**/api/ai/portfolio-analysis",route=>route.fulfill({status:503,json:{error:"Stage 3B offline fixture"}}));
  const before=fixture(db=>({cards:db.prepare("SELECT count(*) n FROM Card").get().n,finance:db.prepare("SELECT count(*) n FROM CardTransaction").get().n}));
  for(const tab of ["overview","trends","structure","details"]) {
    await page.goto("/portfolio?q=Jordan&sport=Basketball&sort=yearAsc&tab="+tab+"&snapshotId=stage3b-snapshot&compareLeft=snapshot%3Astage3b-snapshot&compareRight=current&workspace=1",{waitUntil:"networkidle"});
    const header=page.locator(".portfolio-page header");
    await expect(header.getByRole("searchbox")).toHaveCount(0);
    await expect(header.getByText(/^(调整范围|Adjust scope|快照与比较|Snapshots and comparison)$/)).toHaveCount(0);
    await expect(page.locator('select[name="compareLeft"],select[name="compareRight"],[data-testid="frozen-snapshot"]')).toHaveCount(0);
    await expect(page.getByRole("button",{name:/^(保存当前快照|Save Current Snapshot)$/})).toHaveCount(0);
    await expect(page.locator(".portfolio-page")).not.toContainText("3B old snapshot");
    await expect(page.locator(".portfolio-page").getByRole("alert")).toHaveCount(0);
    const back=header.locator("a.scope-navigation-link");
    const url=new URL(await back.getAttribute("href"),"http://localhost");
    expect(url.searchParams.get("q")).toBe("Jordan");expect(url.searchParams.get("sport")).toBe("Basketball");expect(url.searchParams.get("sort")).toBe("yearAsc");
  }
  fixture(db=>{
    expect(db.prepare("SELECT count(*) n FROM PortfolioSnapshotRecord").get().n).toBe(0);
    expect(db.prepare("SELECT count(*) n FROM PortfolioSavedView").get().n).toBe(0);
    expect(db.prepare("SELECT title FROM CollectionPlan WHERE id='stage3b-wish'").get().title).toBe("3B preserved wish");
    expect({cards:db.prepare("SELECT count(*) n FROM Card").get().n,finance:db.prepare("SELECT count(*) n FROM CardTransaction").get().n}).toEqual(before);
  });
  await page.getByRole("button",{name:/^(组合分析|Portfolio Analysis)$/}).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByText("Stage 3B offline fixture",{exact:true})).toBeVisible();
});

test("financial and activity trend ranges stay independent across tabs and reloads",async({page})=>{
  await page.goto("/portfolio?tab=trends",{waitUntil:"networkidle"});
  const ranges=page.locator('[data-testid="data-trends"] select');
  await expect(ranges).toHaveCount(2);
  await ranges.nth(0).selectOption("6"); await expect(ranges.nth(1)).toHaveValue("12");
  await ranges.nth(1).selectOption("all"); await expect(ranges.nth(0)).toHaveValue("6");
  await ranges.nth(0).selectOption("24"); await expect(ranges.nth(1)).toHaveValue("all");
  await page.getByRole("link",{name:"总览",exact:true}).click();
  await page.getByRole("link",{name:"趋势",exact:true}).click();
  await expect(ranges.nth(0)).toHaveValue("24");await expect(ranges.nth(1)).toHaveValue("all");
  await page.reload({waitUntil:"networkidle"});
  await expect(ranges.nth(0)).toHaveValue("24");await expect(ranges.nth(1)).toHaveValue("all");
  expect(new URL(page.url()).searchParams.get("financialRange")).toBe("24");
  expect(new URL(page.url()).searchParams.get("activityRange")).toBe("all");
});
test("an empty wishlist has no entry hint while unmatched searches still have feedback",async({page})=>{
  fixture(db=>db.exec("DELETE FROM CollectionPlan WHERE id='stage3b-wish'"));
  await page.goto("/collection",{waitUntil:"networkidle"});
  await expect(page.getByRole("button",{name:"新增心愿",exact:true})).toBeEnabled();
  await expect(page.locator(".wish-list")).toHaveText("");
  await expect(page.getByText("暂无心愿，点击“新增心愿”录入。",{exact:true})).toHaveCount(0);
  await page.getByLabel("搜索心愿",{exact:true}).fill("No matching fixture");
  await expect(page.getByText("没有匹配的心愿。",{exact:true})).toBeVisible();
});

test("the reduced Data toolbar and independent trend controls fit all themes and desktop sizes",async({page,context},testInfo)=>{
  test.setTimeout(120000);
  for(const theme of ["classic","gallery","midnight","archive"]) for(const width of [1100,1440]) {
    await context.addCookies([{name:"card_vault_app_theme",value:theme,url:"http://127.0.0.1:3360"}]);
    await page.setViewportSize({width,height:900});
    await page.goto("/portfolio?tab=trends&financialRange=6&activityRange=24",{waitUntil:"networkidle"});
    const ranges=page.locator('[data-testid="data-trends"] select');
    await expect(ranges.nth(0)).toHaveValue("6");await expect(ranges.nth(1)).toHaveValue("24");
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);
    if(width===1100&&(theme==="classic"||theme==="midnight")) await page.screenshot({path:testInfo.outputPath("trends-"+theme+".png"),fullPage:true});
  }
});
