import { test, expect } from "@playwright/test";
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs/promises";
import path from "node:path";
function fixture(action) { const db = new DatabaseSync(path.resolve("tests/.ui-test-runtime/data/dev.db")); try { db.exec("PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000"); return action(db); } finally { db.close(); } }
const ids = id => fixture(db => db.prepare("SELECT cardId FROM ScoutWishCard WHERE planId=? ORDER BY cardId").all(id).map(row => row.cardId));
test("corrupt workspace storage falls back safely and unavailable draft storage is explained", async ({ page }) => {
  await page.goto("/collection", { waitUntil: "networkidle" });
  const { identity } = await (await page.request.get("/api/scout")).json();
  await page.evaluate(identity => sessionStorage.setItem("card-vault:scout:2:" + identity + ":workspace", JSON.stringify({ tab: "query", wishView: null })), identity);
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.getByRole("tab", { name: "跨站查询" })).toHaveAttribute("aria-selected", "true");
  await page.evaluate(() => { Storage.prototype.setItem = () => { throw new Error("Storage unavailable"); }; });
  await page.getByRole("tab", { name: "心愿单" }).click();
  await page.getByRole("button", { name: "新增", exact: true }).click();
  await page.getByLabel("心愿名称", { exact: true }).fill("Scout extra unavailable");
  await expect(page.locator(".wish-draft-status")).toContainText("本机草稿保存不可用");
});
test.afterEach(() => fixture(db => db.exec("DELETE FROM CollectionPlan WHERE id LIKE 'scout-extra-%' OR title LIKE 'Scout extra%'; DELETE FROM ScoutWatch WHERE id LIKE 'scout-extra-%'; DELETE FROM Card WHERE id LIKE 'scout-extra-%'")));

test("wish drafts and search workspace recover after navigation and refresh", async ({ page }) => {
  await page.goto("/collection?tab=wishlist", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "新增", exact: true }).click();
  await page.getByLabel("心愿名称", { exact: true }).fill("Scout extra draft");
  await page.getByLabel("目标数量（可选）", { exact: true }).fill("8");
  await page.goto("/", { waitUntil: "networkidle" });
  await page.goto("/collection", { waitUntil: "networkidle" });
  await expect(page.getByLabel("心愿名称", { exact: true })).toHaveValue("Scout extra draft");
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.getByLabel("目标数量（可选）", { exact: true })).toHaveValue("8");
  await page.getByRole("button", { name: "添加心愿", exact: true }).click();
  await expect(page.locator(".wish-editor")).toHaveCount(0);
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.locator(".wish-editor")).toHaveCount(0);
  await page.getByRole("tab", { name: "跨站查询" }).click();
  await page.getByLabel("关键词", { exact: true }).fill("Scout extra unsaved keyword");
  await page.getByLabel("收起已保存关键词").click();
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.getByLabel("关键词", { exact: true })).toHaveValue("Scout extra unsaved keyword");
  await expect(page.getByLabel("展开已保存关键词")).toHaveAttribute("aria-expanded", "false");
});

test("set wishes retain partial progress, selected-only choices, reverse links and guarded replan undo", async ({ page }) => {
  fixture(db => db.exec("INSERT INTO Card(id,playerName,cardTitle,sport,year,parallel) VALUES('scout-extra-a','Scout extra Jordan','Gold','Basketball','2025','Gold'),('scout-extra-b','Scout extra Jordan','Silver','Basketball','2025','Silver'); INSERT INTO CollectionPlan(id,title,playerName) VALUES('scout-extra-goal','Scout extra set','Jordan'); INSERT INTO ScoutWishDetails(planId,priority,targetCount) VALUES('scout-extra-goal',1,2)"));
  await page.goto("/collection?wish=scout-extra-goal", { waitUntil: "networkidle" });
  let wish = page.locator('[data-wish-id="scout-extra-goal"]');
  await wish.getByRole("button", { name: "记录进度" }).click();
  await wish.getByRole("button", { name: "绑定已录入卡片记录进度" }).click();
  await wish.getByLabel("搜索卡片", { exact: true }).fill("Jordan 2025 Gold");
  await expect(wish.locator(".scout-card-options > label")).toHaveCount(1);
  await wish.getByRole("checkbox", { name: /Scout extra Jordan Gold/ }).check();
  await expect(wish.locator(".scout-binding-selection")).toContainText("新增 1 / 移除 0");
  await wish.getByLabel("仅看已选", { exact: true }).check();
  await wish.getByRole("button", { name: "保存收集进度" }).click();
  await expect(wish).toContainText("进度 1 / 2");
  await expect.poll(() => ids("scout-extra-goal")).toEqual(["scout-extra-a"]);
  await wish.getByRole("button", { name: "记录进度" }).click();
  await wish.getByRole("button", { name: "绑定已录入卡片记录进度" }).click();
  await wish.getByLabel("搜索卡片", { exact: true }).fill("Jordan 2025 Silver");
  await wish.getByRole("checkbox", { name: /Scout extra Jordan Silver/ }).check();
  await wish.getByRole("button", { name: "保存收集进度" }).click();
  await expect(wish).toHaveCount(0);
  await page.getByLabel("已实现", { exact: true }).check();
  await expect(wish).toContainText("进度 2 / 2");
  await wish.getByRole("link", { name: "查看入藏卡片", exact: true }).click();
  await expect(page.getByTestId("home-card-grid").locator(".card-item")).toHaveCount(2);
  await page.goto("/cards/scout-extra-a", { waitUntil: "networkidle" });
  await page.locator(".card-linked-wishes").getByRole("link", { name: "Scout extra set", exact: true }).click();
  wish = page.locator('[data-wish-id="scout-extra-goal"]');
  await expect(wish).toBeFocused();
  page.once("dialog", dialog => dialog.accept());
  await wish.getByRole("button", { name: "重新计划" }).click();
  await expect.poll(() => ids("scout-extra-goal")).toEqual([]);
  await page.getByRole("button", { name: "撤销", exact: true }).click();
  await expect.poll(() => ids("scout-extra-goal")).toEqual(["scout-extra-a", "scout-extra-b"]);
  await expect(wish).toContainText("已实现");
});

test("wishes search subjects and keywords, sort target dates and export independent CSV lists", async ({ page }) => {
  fixture(db => db.exec("INSERT INTO ScoutWatch(id,title,queryJson) VALUES('scout-extra-query','Scout extra Gold 2025','{\"keyword\":\"Scout extra Gold 2025\"}'); INSERT INTO CollectionPlan(id,title,playerName,targetDate) VALUES('scout-extra-late','Scout extra late','Jordan','2027-02-01T00:00:00.000Z'),('scout-extra-early','Scout extra early','Jordan','2027-01-01T00:00:00.000Z'); INSERT INTO ScoutWishWatch VALUES('scout-extra-late','scout-extra-query'),('scout-extra-early','scout-extra-query')"));
  await page.goto("/collection?tab=wishlist", { waitUntil: "networkidle" });
  await page.getByLabel("搜索心愿", { exact: true }).fill("Jordan Gold 2025");
  await page.getByLabel("心愿排序", { exact: true }).selectOption("target");
  await expect(page.locator(".scout-wish .wish-identity > strong")).toHaveText(["Scout extra early", "Scout extra late"]);
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.getByLabel("搜索心愿", { exact: true })).toHaveValue("Jordan Gold 2025");
  const downloaded = page.waitForEvent("download"); await page.locator(".wish-list-toolbar").getByRole("link", { name: "导出" }).click();
  const csv = await downloaded; expect(csv.suggestedFilename()).toBe("card-vault-wishes.csv"); expect(await fs.readFile(await csv.path(), "utf8")).toContain("Scout extra early");
  await page.getByRole("tab", { name: "跨站查询" }).click();
  const keywordsDownload = page.waitForEvent("download"); await page.locator(".scout-saved-actions").getByRole("link", { name: "导出" }).click();
  expect((await keywordsDownload).suggestedFilename()).toBe("card-vault-keywords.csv");
});

test("large selections fold at four cards and prevent adding a 501st archive", async ({ page }) => {
  fixture(db => {
    db.exec("BEGIN; INSERT INTO CollectionPlan(id,title,status) VALUES('scout-extra-limit','Scout extra limit','acquired')");
    const card = db.prepare("INSERT INTO Card(id,playerName,cardTitle,sport) VALUES(?,'Scout extra bulk',?,'Basketball')"), link = db.prepare("INSERT INTO ScoutWishCard VALUES('scout-extra-limit',?)");
    for (let i = 0; i <= 500; i++) { const id = "scout-extra-limit-" + String(i).padStart(3, "0"); card.run(id, "Card " + i); if (i < 500) link.run(id); }
    db.exec("COMMIT");
  });
  await page.goto("/collection?wish=scout-extra-limit", { waitUntil: "networkidle" });
  const wish = page.locator('[data-wish-id="scout-extra-limit"]');
  await wish.getByRole("button", { name: "更换", exact: true }).click();
  await expect(wish.locator(".scout-binding-selection li")).toHaveCount(4);
  await wish.getByLabel("搜索卡片", { exact: true }).fill("Scout extra bulk Card 500");
  await expect(wish.locator(".scout-card-options input[type=checkbox]")).toHaveCount(1);
  await expect(wish.locator(".scout-card-options input")).toBeDisabled();
  await wish.getByLabel("展开已选卡片", { exact: true }).click();
  await expect(wish.locator(".scout-binding-selection li")).toHaveCount(500);
  await wish.getByLabel("收起已选卡片", { exact: true }).click();
  await wish.locator(".scout-binding-selection li").first().getByRole("button").click();
  await expect(wish.locator(".scout-card-options input")).toBeEnabled();
});
