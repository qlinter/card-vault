import { installStudioPhoto } from "./group-photo-fixture.mjs";
import { expect, test } from "@playwright/test";
import { readFile, rm } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { createHash } from "node:crypto";
import { uiDatabasePath, withUiDatabase } from "./database-fixture.mjs";

test("all four layouts require accepted studio images even when every original exists",async ({page})=>{
  const group="Only gallery sources fixture";
  withUiDatabase(db=>{
    for(let i=0;i<3;i++){
      const id="only-gallery-"+i;
      db.prepare("INSERT INTO Card(id,playerName,cardTitle,sport) VALUES(?,?,?,'Football')").run(id,group,"Sample "+i);
      db.prepare("INSERT INTO CardImage(id,cardId,path) VALUES(?,?,'/media/ui-card-1.webp')").run(id+"-front",id);
    }
  });
  try {
    await page.goto("/showcase/group-photo?group="+encodeURIComponent(group));
    for(const mode of ["stage","tiers","wall","mosaic"]){
      await page.getByLabel("构图").selectOption(mode);
      await expect(page.getByRole("button",{name:"生成预览"})).toBeDisabled();
      if (mode === "mosaic") await expect(page.getByRole("button",{name:/AI 检查裁切/})).toHaveCount(0);
      else await expect(page.getByRole("button",{name:"AI 展台精修"})).toBeDisabled();
      await expect(page.getByRole("link",{name:"去补展馆图"})).toHaveCount(3);
      await expect(page.locator(".group-photo-list img")).toHaveCount(0);
    }
    await page.getByRole("button",{name:"移出缺图卡牌"}).click();
    await expect(page.locator(".group-photo-heading small")).toHaveText("已选 0 / 3");
  } finally {withUiDatabase(db=>db.prepare("DELETE FROM Card WHERE playerName=?").run(group));}
});

test("a face-only PNG includes a selection beyond the wall limit and supports crop correction", async ({ page }) => {
  const group = "Seamless mosaic fixture", uploads = path.join(path.dirname(uiDatabasePath), "uploads");
  const file = path.join(uploads, "face-only.png");
  const lowerHalf = await sharp({create:{width:70,height:49,channels:3,background:"#4018cc"}}).png().toBuffer();
  const removeStudios = [];
  const face = await sharp({create:{width:70,height:98,channels:3,background:"#d02925"}})
    .composite([{input:lowerHalf,left:0,top:49}]).png().toBuffer();
  await sharp({create:{width:90,height:118,channels:3,background:"#00ee00"}})
    .composite([{input:face,left:10,top:10}]).png().toFile(file);
  try {
    withUiDatabase(db => {
      const card = db.prepare("INSERT INTO Card(id,playerName,cardTitle,sport) VALUES(?,?,?,'Football')");
      const photo = db.prepare("INSERT INTO CardImage(id,cardId,path,rotation) VALUES(?,?,'/media/face-only.png',?)");
      for (let i = 0; i < 37; i++) {
        const id = "ui-mosaic-" + i;
        card.run(id, group, i === 0 ? "Quarter turn" : i === 1 ? "Upright" : "Card " + i);
        photo.run(id+"-front",id, i % 3 ? 0 : 90);
      }
    });
    for (let i = 0; i < 37; i++) removeStudios.push(await installStudioPhoto("ui-mosaic-"+i, await sharp(file).rotate(i%3 ? 0 : 90).png().toBuffer()));
    await page.goto("/showcase/group-photo?group=" + encodeURIComponent(group));
    await page.getByLabel("构图").selectOption("mosaic");
    await expect(page.getByLabel("标题（选填）")).toHaveCount(0);
    await expect(page.getByText("用录入首图",{exact:true})).toHaveCount(0);
    await page.getByRole("button", { name: "调整裁切" }).first().click();
    const surface = page.locator(".group-crop-surface");
    await expect(surface).toBeVisible();
    const bounds = await surface.boundingBox();
    async function dragCorner(name,x,y) {
      const button = await page.getByRole("button",{name,exact:true}).boundingBox();
      await page.mouse.move(button.x+button.width/2,button.y+button.height/2);
      await page.mouse.down();
      await page.mouse.move(bounds.x+bounds.width*x,bounds.y+bounds.height*y,{steps:8});
      await page.mouse.up();
    }
    await dragCorner("调整左上角",.18,.18);
    await dragCorner("调整右下角",.82,.82);
    const frame = page.locator(".group-crop-frame");
    const beforeMove = await frame.boundingBox();
    const cx = beforeMove.x+beforeMove.width/2, cy = beforeMove.y+beforeMove.height/2;
    await page.mouse.move(cx,cy); await page.mouse.down(); await page.mouse.move(cx+6,cy+4); await page.mouse.up();
    expect((await frame.boundingBox()).x-beforeMove.x).toBeCloseTo(6,0);
    const savedFrame = await frame.getAttribute("style");
    await page.getByRole("button",{name:"保存裁切"}).click();
    await expect(page.getByText("已保存裁切",{exact:true})).toHaveCount(1);
    await page.reload();
    await page.getByLabel("构图").selectOption("mosaic");
    const saved = page.locator(".group-photo-list li").filter({hasText:"已保存裁切"});
    await expect(saved).toHaveCount(1);
    await saved.getByRole("button",{name:"调整裁切"}).click();
    await expect(frame).toHaveAttribute("style",savedFrame);
    await page.getByRole("button",{name:"调整右边",exact:true}).press("ArrowLeft");
    await page.getByRole("button",{name:"关闭",exact:true}).click();
    await saved.getByRole("button",{name:"调整裁切"}).click();
    await expect(frame).toHaveAttribute("style",savedFrame);
    await page.getByRole("button",{name:"关闭",exact:true}).click();
    await page.getByRole("button", {name:"生成预览"}).click();
    const link = page.getByRole("link", {name:"下载 PNG"});
    await expect(link).toBeVisible({timeout:60000});
    const downloaded = page.waitForEvent("download"); await link.click();
    const download = await downloaded;
    expect(download.suggestedFilename()).toBe("Card Vault Mosaic.png");
    const { data, info } = await sharp(await download.path()).resize({width:500}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    let outside = 0;
    for (let i=0; i<data.length; i+=4) if (data[i] < data[i+1] || data[i+3] !== 255) outside++;
    expect(outside / (info.width * info.height)).toBeLessThan(.025);
    // Top/bottom colours verify the actual rotation, not just a tall output box.
    for (const name of ["Quarter turn", "Upright"]) {
      await page.getByRole("searchbox").fill(name);
      await page.getByRole("button", {name:"仅选结果"}).click();
      await page.getByRole("button", {name:"生成预览"}).click();
      const event = page.waitForEvent("download"); await link.click();
      const png = sharp(await (await event).path());
      const {width, height} = await png.metadata();
      expect(height).toBeGreaterThan(width);
      const {data: colours, info: size} = await png.resize(1, 4, {fit:"fill"}).removeAlpha().raw().toBuffer({resolveWithObject:true});
      const redAt = row => colours[row * size.channels] > colours[row * size.channels + 2];
      expect(redAt(0)).toBe(name === "Upright");
      expect(redAt(3)).toBe(name === "Quarter turn");
    }
  } finally {
    withUiDatabase(db => db.prepare("DELETE FROM Card WHERE playerName=?").run(group));
    await Promise.all(removeStudios.map(remove => remove()));
    await rm(file, {force:true});
  }
});

test("a saved gallery crop can be reset and an old editor cannot overwrite a replacement photo", async ({page}) => {
  const pathToEditor = "/showcase/group-photo?group=Jordan%20Lee";
  const portrait = await readFile("public/studio-style/portrait.png"), landscape = await readFile("public/studio-style/landscape.png");
  let remove = await installStudioPhoto("ui-card-1",portrait);
  const edit = page.getByRole("button",{name:"调整裁切"});
  const save = page.getByRole("button",{name:"保存裁切"});
  const saved = page.getByText("已保存裁切",{exact:true});
  const open = async () => {
    await page.goto(pathToEditor);
    await page.getByLabel("构图").selectOption("mosaic");
    await edit.click();
    await expect(save).toBeEnabled();
  };
  try {
    await open();
    const stale = await page.context().newPage();
    await stale.goto("/showcase/group-photo");
    await stale.getByRole("searchbox").fill("Jordan");
    await stale.getByRole("button",{name:"仅选结果"}).click();
    const selection = await stale.locator(".group-photo-heading small").innerText();
    await stale.getByLabel("构图").selectOption("mosaic");
    await stale.getByRole("button",{name:"调整裁切"}).click();
    await expect(stale.getByRole("button",{name:"保存裁切"})).toBeEnabled();
    await page.getByRole("button",{name:"调整下边",exact:true}).press("ArrowUp");
    await page.route("**/api/studio/crop", route => route.fulfill({status:503}),{times:1});
    await save.click();
    await expect(page.locator(".group-calibration").getByRole("alert")).toContainText("裁切保存失败");
    await save.click();
    await expect(saved).toBeVisible();
    await stale.getByRole("button",{name:"保存裁切"}).click();
    await expect(stale.locator(".group-calibration [role=alert]")).toContainText("其他窗口");
    await stale.getByRole("button",{name:"载入最新裁切"}).click();
    await expect(stale.getByRole("button",{name:"恢复自动"})).toBeVisible();
    await expect(stale.getByRole("button",{name:"保存裁切"})).toBeEnabled();
    await expect(stale.getByLabel("构图")).toHaveValue("mosaic");
    await expect(stale.getByRole("searchbox")).toHaveValue("Jordan");
    await expect(stale.locator(".group-photo-heading small")).toHaveText(selection);
    await stale.getByRole("button",{name:"保存裁切"}).click();
    await expect(stale.locator(".group-calibration")).toHaveCount(0);
    await stale.close();
    await open();
    await page.getByRole("button",{name:"恢复自动"}).click();
    await expect(edit).toBeVisible();
    await expect(save).toHaveCount(0);
    await expect(saved).toHaveCount(0);
    await open();
    await save.click();
    await expect(saved).toBeVisible();
    await edit.click();
    await expect(save).toBeEnabled();
    await remove();
    remove = await installStudioPhoto("ui-card-1",landscape);
    await save.click();
    await expect(page.locator(".group-calibration").getByRole("alert")).toContainText("展馆图已更新");
    await page.getByRole("button",{name:"载入最新裁切"}).click();
    await expect(save).toBeEnabled();
    await page.getByRole("button",{name:"关闭",exact:true}).click();
    await expect(saved).toHaveCount(0);
    await expect(page.getByRole("button",{name:"生成预览"})).toBeEnabled();
  } finally { await remove(); }
});

test("search scopes selection and ordering to matches and shows each layout limit", async ({ page }) => {
  const group = "Photo search fixture";
  withUiDatabase(db => {
    const add = db.prepare("INSERT INTO Card(id,playerName,cardTitle,sport,team,productLine,year,tags) VALUES(?,?,?,'Football',?,'Prizm','2024',?)");
    for (const [id, name, team, tags] of [["a","A","Inter","蓝黑"], ["b","B","Roma",""], ["c","C","Inter","蓝黑"]]) {
      add.run("group-search-" + id, group, name, team, tags);
    }
  });
  try {
    await page.goto("/showcase/group-photo?group=" + encodeURIComponent(group));
    const search = page.getByRole("searchbox", { name: "搜索卡牌" });
    const rows = page.locator(".group-photo-list li"), names = rows.locator("strong + span");
    const count = page.locator(".group-photo-heading small");
    await expect(page.getByLabel("构图").locator("option")).toHaveText(["自动", "精选陈列 · 1–5 张", "错层看台 · 3–7 张", "系列展墙 · 1–36 张", "无缝拼图 · 1–4096 张"]);
    const originalOrder = await names.allTextContents();
    const hits = originalOrder.filter(name => name !== "B");
    await search.fill(" INTER   2024 蓝黑 prIZm ");
    await expect(names).toHaveText(hits);
    await expect(count).toHaveText("已选 3 / 3");
    const layout = page.getByLabel("构图");
    await layout.selectOption("wall");
    for (const width of [1440, 1100]) {
      await page.setViewportSize({ width, height: 900 });
      const searchBox = await search.boundingBox(), layoutBox = await layout.boundingBox();
      expect(searchBox.x + searchBox.width).toBeLessThan(layoutBox.x);
      expect(await layout.evaluate(select => {
        const style = getComputedStyle(select), ctx = document.createElement("canvas").getContext("2d");
        ctx.font = style.fontSize + " " + style.fontFamily;
        return ctx.measureText(select.selectedOptions[0].text).width + parseFloat(style.paddingLeft) + parseFloat(style.paddingRight) <= select.clientWidth;
      })).toBe(true);
    }
    await rows.last().getByRole("button", { name: "上移" }).click();
    await expect(names).toHaveText([...hits].reverse());
    await page.getByRole("button", { name: "移除结果" }).click();
    await expect(count).toHaveText("已选 1 / 3");
    await page.getByRole("button", { name: "加入结果" }).click();
    await expect(count).toHaveText("已选 3 / 3");
    await page.getByRole("button", { name: "仅选结果" }).click();
    await search.fill("missing");
    await expect(rows).toHaveCount(0);
    await expect(page.getByText("没有匹配的卡牌，试试其他关键词。")).toBeVisible();
    await expect(page.getByRole("button", { name: "仅选结果" })).toBeDisabled();
    await search.fill("");
    await expect(count).toHaveText("已选 2 / 3");
    await expect(names).toHaveText(originalOrder.map(name => name === "B" ? name : name === hits[0] ? hits[1] : hits[0]));
    await expect(rows.filter({ has: page.locator("strong + span", { hasText: /^B$/ }) }).getByRole("checkbox")).not.toBeChecked();
  } finally {
    withUiDatabase(db => db.prepare("DELETE FROM Card WHERE playerName=?").run(group));
  }
});

test("page two includes the full filtered collection and an oversized selection can be reduced", async ({ page }) => {
  const group = "Group photo paging fixture";
  withUiDatabase(db => {
    const add = db.prepare("INSERT INTO Card(id,playerName,cardTitle,sport,visibility) VALUES(?,?,?,'Football','private')");
    const image = db.prepare("INSERT INTO CardImage(id,cardId,path) VALUES(?,?,'/media/ui-card-1.webp')");
    db.exec("BEGIN");
    for (let i = 0; i < 4096; i++) {
      const id = "group-page-" + i;
      add.run(id, group, "Card " + i); image.run(id+"-front", id);
    }
    db.exec("COMMIT");
  });
  try {
    await page.goto("/showcase?group=" + encodeURIComponent(group) + "&page=2");
    await expect(page.locator(".showcase-card")).toHaveCount(48);
    await page.getByRole("link", { name: "导出合影" }).click();
    await expect(page.locator(".group-photo-list li")).toHaveCount(100);
    await expect(page.locator(".group-photo-heading small")).toHaveText("已选 4096 / 4096");
    await expect(page.locator(".group-photo-status")).toContainText("最多 36 张");
    await expect(page.locator(".group-photo-status")).toContainText("4096 张私密");
    await page.getByRole("button", { name: "清空", exact: true }).click();
    const rows = page.locator(".group-photo-list li");
    for (const row of [rows.first(), rows.nth(1)]) await row.getByRole("checkbox").first().check();
    const second = await rows.nth(1).locator("strong + span").textContent();
    await rows.nth(1).getByRole("button", { name: "上移" }).click();
    await expect(rows.first().locator("strong + span")).toHaveText(second);
    await expect(page.getByRole("button", { name: "生成预览" })).toBeDisabled();
    await page.getByRole("link", { name: "返回展墙" }).click();
    expect(new URL(page.url()).searchParams.get("page")).toBe("2");
  } finally {
    withUiDatabase(db => db.prepare("DELETE FROM Card WHERE playerName=?").run(group));
  }
});

test("filtered owner selection uses only an accepted studio image and downloads the preview", async ({ page }) => {
  await page.goto("/showcase?group=Jordan%20Lee");
  await page.getByRole("link", { name: "导出合影" }).click();
  const list = page.locator(".group-photo-list li");
  await expect(list).toHaveCount(1);
  const generate = page.getByRole("button", { name: "生成预览" });
  await expect(generate).toBeDisabled();
  await expect(page.getByRole("link",{name:"去补展馆图"})).toBeVisible();
  const remove = await installStudioPhoto("ui-card-1", await readFile("public/studio-style/portrait.png"));
  try {
    await page.reload();
    await expect(generate).toBeEnabled();
    await page.getByRole("button", { name: "校准卡面" }).click();
    const calibration = page.locator(".group-calibration-surface");
    await expect(calibration).toBeVisible();
    await calibration.click({ position: { x: 40, y: 30 } });
    await calibration.click({ position: { x: 40, y: 135 } });
    await page.getByRole("button", { name: "应用校准" }).click();
    await expect(page.getByRole("button", { name: "已校准" })).toBeVisible();
    await page.getByLabel("标题（选填）").fill("Test print");
    await page.evaluate(() => {
      const create = URL.createObjectURL;
      URL.createObjectURL = function(blob) {
        const url = create.call(URL, blob);
        window.previewBlobs = new Map([[url, blob]]);
        return url;
      };
    });
    await generate.click();
    const image = page.getByRole("img", { name: "合影预览" });
    await expect(image).toBeVisible();
    const previewUrl = await image.getAttribute("src");
    await page.getByRole("searchbox").fill("no match");
    await expect(image).toHaveAttribute("src", previewUrl);
    const expected = await image.evaluate(async img => {
      const digest = await crypto.subtle.digest("SHA-256", await window.previewBlobs.get(img.src).arrayBuffer());
      return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
    });
    const downloadEvent = page.waitForEvent("download");
    await page.getByRole("link", { name: "下载 PNG" }).click();
    const download = await downloadEvent;
    expect(download.suggestedFilename()).toBe("Test print.png");
    expect(createHash("sha256").update(await readFile(await download.path())).digest("hex")).toBe(expected);
    await page.getByLabel("标题（选填）").fill("Changed");
    await expect(page.getByRole("link", { name: "下载 PNG" })).toHaveCount(0);
    await page.getByRole("link", { name: "返回展墙" }).click();
    expect(new URL(page.url()).searchParams.get("group")).toBe("Jordan Lee");
  } finally {await remove();}
});
