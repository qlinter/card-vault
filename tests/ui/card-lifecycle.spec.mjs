import { readFile } from "node:fs/promises";
import { installStudioPhoto } from "./group-photo-fixture.mjs";
import { withUiDatabase } from "./database-fixture.mjs";
import { expect, test } from "@playwright/test";

test("card timeline separates milestones from routine entries at desktop and phone widths", async ({ page }) => {
  await page.goto("/cards/ui-card-1");
  const timeline = page.locator(".card-lifecycle");
  const rows = timeline.getByRole("listitem");
  await expect(rows).toHaveCount(2);
  await expect(rows.filter({ hasText: "记录评级费用" })).toHaveCount(0);
  await expect(rows.last()).toContainText("买入");
  await timeline.getByRole("button", { name: "全部记录", exact: true }).click();
  await expect(rows).toHaveCount(5);
  await expect(rows.filter({ hasText: "记录评级费用" })).toContainText("PSA");
  await expect(rows.filter({ hasText: "记录估值" })).toHaveCount(2);
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await timeline.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    if (width === 1440) {
      await page.evaluate(()=>window.scrollTo({top:0,behavior:"instant"}));
      await page.screenshot({path:"logs/v172-detail-desktop.png"});
    }
    await timeline.screenshot({ path: `logs/v172-card-timeline-${width}.png` });
  }
  await timeline.getByRole("button", { name: "收起", exact: true }).click();
  await expect(rows).toHaveCount(2);
});

test("create a gift, switch photos, transfer it and view the resulting ledger",async({page})=>{
  await page.goto("/cards/new");
  await page.locator('[name="playerName"]').fill("Gift workflow");
  await page.locator('[name="cardTitle"]').fill("Archive gift");
  await page.locator('[name="sport"]').fill("Basketball");
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=","base64");
  await page.locator('[data-card-entry-form] [name="images"]').setInputFiles(["front.png","back.png"].map(name=>({name,mimeType:"image/png",buffer:png})));
  await page.getByText("财务记录（可选）",{exact:true}).click();
  await page.locator('[name="acquisitionMethod"]').selectOption("gift_in");
  await expect(page.locator('[name="purchasePrice"]')).toHaveCount(0);
  await page.locator('[name="purchaseDate"]').fill("2026-01-01");
  await page.locator('[name="purchaseSource"]').fill("Friend");
  await page.getByRole("button",{name:"保存并查看"}).click();
  await expect(page).toHaveURL(/success=created/);
  const id=new URL(page.url()).pathname.split("/").pop();
  try {
    await expect(page.locator(".archive-history")).toContainText("获赠");
    const back = page.getByRole("button",{name:"第 2 张图片"});
    await back.click();
    await expect(back).toHaveAttribute("aria-pressed","true");
    await expect(page.locator(".archive-main-image img")).toHaveAttribute("src",await back.locator("img").getAttribute("src"));
    await page.getByRole("button",{name:"新增财务记录"}).click();
    await page.locator(".financial-record-type select").selectOption("gift_out");
    const form=page.locator("#financial-add-record form:visible");
    await expect(form.locator('[name="amount"]')).toHaveCount(0);
    await form.locator('[name="occurredAt"]').fill("2026-02-01");
    await form.getByRole("button",{name:"保存交易"}).click();
    await expect(page.locator(".archive-status")).toContainText("已赠出");
    await expect(page.locator(".archive-history")).toContainText("赠送");
    expect(withUiDatabase(db=>db.prepare("SELECT kind,amountMinor,amountKnown FROM CardTransaction WHERE cardId=? ORDER BY occurredAt").all(id))).toEqual([
      {kind:"gift_in",amountMinor:0,amountKnown:1},{kind:"gift_out",amountMinor:0,amountKnown:1}
    ]);
  } finally {withUiDatabase(db=>db.prepare("DELETE FROM Card WHERE id=?").run(id));}
});

test("a card with no photos uses the full overview width and links to image upload",async({page})=>{
  const id="layout-empty-photo";
  withUiDatabase(db=>db.prepare("INSERT INTO Card(id,playerName,cardTitle,sport) VALUES(?,?,?,?)").run(id,"Empty layout","No photo","Basketball"));
  try {
    await page.goto("/cards/"+id);
    await expect(page.locator(".archive-main-image")).toHaveCount(0);
    const panel=page.locator(".archive-overview > .panel");
    expect((await panel.boundingBox()).width).toBeGreaterThan((await page.locator(".archive-overview").boundingBox()).width*.95);
    await page.getByRole("link",{name:"添加图片"}).click();
    await expect(page.locator("#archive-images input[type=file]")).toBeVisible();
  } finally {withUiDatabase(db=>db.prepare("DELETE FROM Card WHERE id=?").run(id));}
});

test("desktop overview panels share a height and give extra space to the main photo", async ({ page }) => {
  const id = "equal-height-gallery";
  withUiDatabase(db => {
    db.prepare("INSERT INTO Card(id,playerName,cardTitle,sport) VALUES(?,?,?,?)").run(id,"Diego Milito","Historical Significance","Football");
    db.prepare("INSERT INTO CardImage(id,cardId,path) VALUES(?,?,?)").run(id+"-front",id,"/studio-style/portrait.png");
  });
  const overview = page.locator(".archive-overview");
  const left = overview.locator(".archive-image-panel");
  const right = overview.locator(".panel").last();
  const main = left.locator(".archive-main-image");
  const visibility = right.locator(".archive-facts > div").filter({has: page.getByText("公开状态",{exact:true})}).locator("dd");
  let removeStudioPhoto;
  async function checkAlignment() {
    const [image, info] = await Promise.all([left.boundingBox(), right.boundingBox()]);
    expect(image.x + image.width).toBeLessThan(info.x);
    expect(Math.abs(image.y - info.y)).toBeLessThan(1);
    expect(Math.abs(image.height - info.height)).toBeLessThan(1);
  }
  try {
    await page.setViewportSize({width:1100,height:760});
    await page.goto("/cards/"+id);
    await checkAlignment();
    const initial = await main.boundingBox();
    const info = await right.boundingBox(), lastField = await visibility.boundingBox();
    expect(info.y + info.height - lastField.y - lastField.height).toBeGreaterThan(30);

    await expect(right.getByRole("link",{name:"待生成"})).toHaveAttribute("href",/edit#studio-image$/);
    removeStudioPhoto = await installStudioPhoto(id, await readFile("public/studio-style/portrait.png"));
    withUiDatabase(db => db.prepare(`UPDATE Card SET visibility='public', team='Inter', year='2017', brand='Panini', productLine='Immaculate',
      subsetName='Historical Significance', cardNumber='HSDMI', gradingCompany='PSA', grade='9', certNumber='98648938',
      autoType='Autograph', isAutograph=1, serialNumber='06', serialRange='/10', tags='Inter,Autograph' WHERE id=?`).run(id));
    await page.reload();
    await checkAlignment();
    expect((await main.boundingBox()).height).toBeGreaterThan(initial.height + 10);
    await expect(visibility).toHaveText("公开");
    await expect(visibility).toBeVisible();
    await expect(right.locator(".archive-facts dd").getByRole("link",{name:"已生成"})).toHaveAttribute("href",/edit#studio-image$/);
    await main.locator("img").evaluate(img => img.decode());
    await overview.screenshot({path:"logs/v172-equal-panels-desktop.png"});
    await page.setViewportSize({width:1440,height:900});
    await checkAlignment();
    await overview.screenshot({path:"logs/v172-card-information-desktop.png"});

    withUiDatabase(db => db.prepare("INSERT INTO CardImage(id,cardId,path,sortOrder,rotation) VALUES(?,?,?,1,90)").run(id+"-back",id,"/studio-style/landscape.png"));
    await page.reload();
    await page.getByRole("button",{name:"第 2 张图片"}).click();
    await checkAlignment();
    const frame = await main.boundingBox(), turned = await main.locator("img.quarter-turn").boundingBox();
    expect(Math.abs(frame.width - turned.width)).toBeLessThan(1);
    expect(Math.abs(frame.height - turned.height)).toBeLessThan(1);
    const strip = await left.locator(".archive-thumbnails").boundingBox();
    expect(strip.y).toBeGreaterThanOrEqual(frame.y + frame.height);
    await page.setViewportSize({width:390,height:844});
    const stacked = await left.boundingBox();
    expect((await right.boundingBox()).y).toBeGreaterThanOrEqual(stacked.y + stacked.height);
    const longValue = "Immaculate".repeat(16);
    withUiDatabase(db => db.prepare("UPDATE Card SET visibility='linkOnly',productLine=?,tags=?,gradingLink=? WHERE id=?").run(longValue,longValue,"https://example.com/grade",id));
    await page.reload();
    await expect(right.getByRole("link",{name:"查看评级页面"})).toHaveAttribute("href","https://example.com/grade");
    await expect(visibility).toHaveText("仅链接可见");
    await expect(visibility).toBeVisible();
    for (const width of [1440,1100,320]) {
      await page.setViewportSize({width,height:900});
      const fields = right.locator(".archive-facts dt, .archive-facts dd");
      expect(await fields.evaluateAll(els => els.every(el => el.scrollWidth <= el.clientWidth + 1))).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
  } finally { try { await removeStudioPhoto?.(); } finally { withUiDatabase(db => db.prepare("DELETE FROM Card WHERE id=?").run(id)); } }
});
