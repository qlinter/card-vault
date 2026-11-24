import { expect, test } from "@playwright/test";
import { createHash } from "node:crypto";
import { mkdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { uiDatabasePath, withUiDatabase } from "./database-fixture.mjs";

test("Showcase shares the studio or original source across wall, detail, lightbox and gallery", async ({ page }) => {
  const id = "source-fixture", front = "/media/ui-card-1.webp";
  const digest = createHash("sha256").update(JSON.stringify([id, "source-front", front, 90, false])).digest("hex");
  const folder = path.join(path.dirname(uiDatabasePath), "studio-images"), file = path.join(folder, digest + ".png");
  await mkdir(folder, { recursive: true });
  await sharp({ create: { width: 48, height: 64, channels: 3, background: "blue" } }).png().toFile(file);
  withUiDatabase(db => {
    db.prepare("INSERT INTO Card(id,playerName,cardTitle,sport) VALUES(?,?,?,'Basketball')").run(id, "Source Fixture", "Source test");
    db.prepare("INSERT INTO CardImage(id,cardId,path,rotation) VALUES(?,?,?,90)").run("source-front", id, front);
    db.prepare("INSERT INTO ShareCollection(id,title,slug) VALUES(?,?,?)").run(id, "Source test", id);
    db.prepare("INSERT INTO ShareCollectionItem(id,shareCollectionId,cardId) VALUES(?,?,?)").run(id,id,id);
  });
  try {
    await page.goto("/showcase?group=Source+Fixture");
    const source = page.getByRole("group", { name: "图片来源" });
    await expect(source.getByRole("button", { name: "AI 展馆图" })).toHaveAttribute("aria-pressed", "true");
    const wall = page.locator(".showcase-card img");
    await expect(wall).toHaveAttribute("src", /studio=thumbnail/);
    await expect.poll(() => wall.evaluate(img => img.naturalWidth)).toBeGreaterThan(0);
    await page.locator(".showcase-card").click();
    await expect(page.locator(".showcase-detail-main-frame img")).toHaveAttribute("src", /studio=png/);
    await page.getByRole("button", { name: "查看大图" }).click();
    await expect(page.getByRole("dialog").locator("img")).toHaveAttribute("src", /studio=png/);
    await page.keyboard.press("Escape");
    await source.getByRole("button", { name: "录入原图" }).click();
    await expect(page.locator(".showcase-detail-main-frame img")).toHaveAttribute("src", front);
    await page.getByRole("link", { name: "返回展墙" }).click();
    await expect(wall).toHaveAttribute("src", /thumbnails/);
    await page.getByRole("button", { name: "浏览", exact: true }).click();
    const viewer = page.getByRole("dialog");
    await expect(viewer.locator(".immersive-art img")).toHaveAttribute("src", /studio=png/);
    await viewer.getByRole("button", { name: "展馆设置", exact: true }).click();
    const mode = viewer.getByRole("combobox", { name: "播放模式" });
    await expect(mode.locator("option")).toHaveText(["AI 展馆图", "录入原图 · 首图", "录入原图 · 全部"]);
    await expect(mode).toHaveValue("studio");
    await mode.selectOption("first");
    await expect(viewer.locator(".immersive-art img")).toHaveAttribute("src", front);
    await mode.selectOption("studio");
    await expect(viewer.locator(".immersive-art img")).toHaveAttribute("src", /studio=png/);
    await viewer.getByRole("button", { name: "保存", exact: true }).click();
    await page.keyboard.press("Escape"); await page.keyboard.press("Escape");
    await expect(wall).toHaveAttribute("src", /studio=thumbnail/);
    await page.goto("/shares/" + id + "/edit");
    await page.locator('input[type="search"]').fill("Source Fixture");
    await expect(page.locator('img[src*="studio=thumbnail"]').first()).toBeAttached();
    await page.goto("/shares/" + id + "/preview");
    await expect(page.locator("iframe")).toHaveAttribute("srcdoc", /studio=png/);
    await source.getByRole("button", { name: "录入原图" }).click();
    await expect(page.locator("iframe")).toHaveAttribute("srcdoc", /ui-card-1.webp/);
    await page.goto("/shares/" + id + "/export");
    await source.getByRole("button", { name: "AI 展馆图" }).click();
    await expect(source.getByRole("button", { name: "AI 展馆图" })).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "生成分享包" }).click();
    await expect(page).toHaveURL(/success=drop/);
    const folder = new URL(page.url()).searchParams.get("path");
    const exported = JSON.parse(await readFile(path.join(folder,"assets","data.json"), "utf8"));
    expect(exported.cards[0].images[0]).toMatchObject({ width: 48, height: 64, sourceRotation: 0 });
  } finally {
    withUiDatabase(db => { db.prepare("DELETE FROM ShareCollection WHERE id=?").run(id); db.prepare("DELETE FROM Card WHERE id=?").run(id); });
    await rm(file, { force: true });
  }
});
