import { installStudioPhoto } from "./group-photo-fixture.mjs";
import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import sharp from "sharp";

async function downloadPreview(page) {
  const event = page.waitForEvent("download");
  await page.getByRole("link",{name:"下载 PNG"}).click();
  return (await event).path();
}
async function postedForm(route) {
  return new Response(route.request().postDataBuffer(), {headers:{"Content-Type":route.request().headers()["content-type"]}}).formData();
}

test("studio lighting builds from the accepted gallery photograph, keeps a local preview on failure and reuses an identical set", async ({page}) => {
  let calls = 0;
  await page.route("**/api/studio/group-photo", async route => {
    const form = await postedForm(route);
    expect(form.get("action")).toBe("stage");
    expect(form.getAll("image")).toHaveLength(1);
    expect(form.get("image").name).toBe("studio-reference.jpg");
    expect(JSON.parse(form.get("layout")).front).toBeGreaterThan(0);
    const input = sharp(Buffer.from(await form.get("image").arrayBuffer()));
    if (++calls === 1) return route.fulfill({status:400,json:{error:"key"}});
    const {width,height} = await input.metadata();
    return route.fulfill({contentType:"image/png",body:await sharp({create:{width,height,channels:3,background:"#b0b8c5"}}).png().toBuffer()});
  });
  const remove = await installStudioPhoto("ui-card-1",await readFile("public/studio-style/portrait.png"));
  try {
  await page.goto("/showcase/group-photo?group=Jordan%20Lee");
  await page.getByRole("button",{name:"生成预览"}).click();
  const local = await downloadPreview(page);
  expect(calls).toBe(0);
  const refine = page.getByRole("button",{name:"AI 展台精修",exact:true});
  await refine.click();
  await expect(page.getByText("请先在 AI 设置中保存图片服务密钥。",{exact:false})).toBeVisible();
  await expect(page.getByRole("link",{name:"下载 PNG"})).toBeVisible();
  await refine.click();
  await expect(page.locator(".group-photo-status")).toContainText("AI 展台精修 ·");
  const ai = await downloadPreview(page);
  const meta = await sharp(local).metadata();
  const sample = (file,x,y) => sharp(file).extract({left:Math.round(meta.width*x),top:Math.round(meta.height*y),width:10,height:10}).raw().toBuffer();
  expect(await sample(ai,.5,.45)).toEqual(await sample(local,.5,.45));
  expect(await sample(ai,.05,.05)).not.toEqual(await sample(local,.05,.05));
  await page.getByRole("button",{name:"生成预览"}).click();
  await expect(page.locator(".group-photo-status")).not.toContainText("AI 展台精修 ·");
  await refine.click();
  await expect(page.locator(".group-photo-status")).toContainText("AI 展台精修 ·");
  expect(calls).toBe(2);
  } finally { await remove(); }
});
