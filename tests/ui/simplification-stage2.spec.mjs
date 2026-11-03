import { withUiDatabase as fixture } from './database-fixture.mjs';
import { expect, test } from "@playwright/test";
import fs from "node:fs";
test.afterEach(() => fixture(db => db.exec("DELETE FROM Card WHERE id LIKE 'stage2-%'; DELETE FROM CollectionTaskState WHERE id LIKE 'stage2-%'")));

test("three primary destinations keep sharing, scout and Settings accessible", async ({ page, context }) => {
  await page.goto("/", { waitUntil: "networkidle" });
  await expect(page.locator(".nav-links a")).toHaveText(["收藏", "展示", "统计"]);
  await page.getByRole("link", { name: "目标 & 寻卡", exact: true }).click();
  await expect(page.locator('.nav-links a[aria-current="page"]')).toHaveText("收藏");
  await expect(page.getByRole("heading", { name: "心愿单", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "跨站查询", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "展示", exact: true }).click();
  await page.locator(".showcase-shares").click();
  await expect(page).toHaveURL(/\/shares$/);
  await expect(page.locator('.nav-links a[aria-current="page"]')).toHaveText("展示");
  await page.getByRole("link", { name: "设置", exact: true }).click();
  await expect(page.locator(".header-settings")).toHaveAttribute("aria-current", "page");
  await context.addCookies([{ name: "card_vault_ui_locale", value: "en", url: "http://127.0.0.1:3360" }]);
  await page.goto("/", { waitUntil: "networkidle" });
  await expect(page.locator(".nav-links a")).toHaveText(["Collection", "Showcase", "Statistics"]);
  await expect(page.getByRole("link", { name: "Goals & search", exact: true })).toBeVisible();
});

test("descriptions and notes share the first row with tags on the next row in every theme", async ({ page, context }) => {
  test.setTimeout(120000);
  for (const theme of ["classic", "gallery", "midnight", "archive"]) {
    await context.addCookies([{ name: "card_vault_app_theme", value: theme, url: "http://127.0.0.1:3360" }]);
    for (const width of [1100, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto("/cards/new", { waitUntil: "networkidle" });
      await page.getByText("标签与描述（可选）", { exact: true }).click();
      const form = page.locator("[data-card-entry-form]");
      const fields = await form.evaluate(element => ["publicDescription", "notes", "tags"].map(name => {
        const input = element.querySelector(`[name="${name}"]`);
        const { x, y, width, height } = input.getBoundingClientRect();
        return { name, x, y, width, height };
      }));
      expect(Math.abs(fields[0].y - fields[1].y)).toBeLessThanOrEqual(1);
      expect(fields[1].x).toBeGreaterThan(fields[0].x + fields[0].width);
      expect(fields[2].y).toBeGreaterThanOrEqual(fields[0].y + fields[0].height);
      expect(fields[2].x).toBe(fields[0].x);
      expect(fields[2].width).toBeGreaterThan(fields[0].width * 1.9);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    }
  }
});

test("Collection export uses applied filters and keeps selection on a failed select-all request", async ({ page }) => {
  fixture(db => {
    const insert = db.prepare("INSERT INTO Card(id,playerName,cardTitle,sport,team,isAutograph,visibility,notes) VALUES(?,'Stage 2 export',?,'Basketball',?,?,'public','private notes sentinel')");
    insert.run("stage2-export-a", "Match A", "Export team", 0);
    insert.run("stage2-export-b", "Match B", "Export team", 0);
    insert.run("stage2-export-c", "Outside filter", "Other team", 0);
    insert.run("stage2-export-d", "Autographed", "Export team", 1);
  });
  await page.goto("/?q=Stage+2+export&team=Export+team&isAutograph=false&sort=yearAsc", { waitUntil: "networkidle" });
  await page.locator('input[name="q"]').fill("Not applied");
  await page.getByRole("link", { name: "导出", exact: true }).click();
  const cards = page.getByTestId("home-card-grid").locator(".card-item");
  await expect(cards).toHaveCount(2);
  await cards.first().getByRole("checkbox").check();
  await page.route("**/api/data-center?*", route => route.fulfill({ status: 400, json: { error: "选择暂不可用，请重试。" } }));
  await page.getByRole("button", { name: "选择全部结果", exact: true }).click();
  await expect(page.locator(".collection-export").getByRole("alert")).toHaveText("选择暂不可用，请重试。");
  await expect(cards.first().getByRole("checkbox")).toBeChecked();
  await page.unroute("**/api/data-center?*");
  await page.getByRole("button", { name: "选择全部结果", exact: true }).click();
  await expect(page.locator(".collection-export-heading p")).toHaveText("已选 2 张");
  await page.getByLabel("仅导出公开档案").check();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "CSV", exact: true }).click();
  const download = await downloadPromise;
  expect(await download.failure()).toBeNull();
  const csv = fs.readFileSync(await download.path(), "utf8");
  expect(csv).toContain("Match A");
  expect(csv).toContain("Match B");
  expect(csv).not.toContain("Outside filter");
  expect(csv).not.toContain("Autographed");
  expect(csv).not.toContain("private notes sentinel");
  await page.getByRole("link", { name: "结束导出", exact: true }).click();
  expect(new URL(page.url()).searchParams.get("team")).toBe("Export team");
  expect(new URL(page.url()).searchParams.get("isAutograph")).toBe("false");
  await expect(cards.getByRole("checkbox")).toHaveCount(0);
  await page.goto("/settings/data#data-export", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "导出全部数据", exact: true })).toBeVisible();
  await expect(page.locator(".management-card-list, .export-search, .export-pagination")).toHaveCount(0);
  await expect(page.getByRole("link", { name: /前往收藏筛选与导出/ })).toHaveAttribute("href", "/?export=1");
});

test("one review workspace separates automatic gaps from follow-ups and preserves reminder history", async ({ page, request }) => {
  fixture(db => db.exec("INSERT INTO Card(id,playerName,cardTitle,sport,collectionStatus,updatedAt) VALUES('stage2-review-gap','Stage 2 review','Data gap','Basketball','holding','2025-01-01T00:00:00.000Z'),('stage2-review-grading','Stage 2 review','Grade follow-up','Basketball','grading','2025-01-01T00:00:00.000Z'),('stage2-review-listed','Stage 2 review','Listed follow-up','Basketball','listed','2025-01-01T00:00:00.000Z')"));
  fixture(db => db.exec("UPDATE CardTracking SET statusStartedAt='2025-01-01T00:00:00.000Z' WHERE cardId LIKE 'stage2-review-%'"));
  const tasks = await (await request.get("/api/home-overview?tasks=1&q=Stage+2+review")).json();
  const imageReminder = tasks.tasks.find(task => task.id === "stage2-review-gap:images");
  const result = await request.post("/api/collection-management", { headers: { Origin: "http://127.0.0.1:3360" }, data: { action: "task", id: imageReminder.id, fingerprint: imageReminder.fingerprint, status: "dismissed" } });
  expect(result.ok()).toBe(true);
  await page.goto("/portfolio?q=Stage+2+review", { waitUntil: "networkidle" });
  await expect(page.locator(".overview-review-summary")).toHaveCount(0);
  const entry = page.getByRole("link", { name: /待完善数据/ });
  await expect(entry).toContainText("待跟进 2");
  await entry.click();
  await expect(page.getByTestId("data-details").locator("tbody tr")).toHaveCount(3);
  await page.locator(".collection-follow-up-toggle").click();
  await expect(page.locator(".management-task")).toHaveCount(2);
  await expect(page.locator(".management-task")).not.toContainText(["补充卡图", "补充卡图"]);
  await page.getByLabel("显示已处理").check();
  const old = page.locator(".management-task").filter({ hasText: "Data gap" });
  await expect(old).toContainText("已忽略");
  await old.getByRole("button", { name: "重新打开", exact: true }).click();
  await expect(old).toHaveCount(0);
  const grading = page.locator(".management-task").filter({ hasText: "Grade follow-up" });
  await grading.getByRole("button", { name: "完成", exact: true }).click();
  await expect(grading).toContainText("已完成");
  await page.getByRole("button", { name: "撤销", exact: true }).click();
  await expect(grading).toContainText("待处理");
  const before = fixture(db => db.prepare("SELECT * FROM CollectionTaskState WHERE id LIKE 'stage2-%' ORDER BY id").all());
  fixture(db => db.exec("INSERT INTO CardImage(id,cardId,path) VALUES('stage2-gap-image','stage2-review-gap','/media/ui-card-1.webp')"));
  await page.goto("/portfolio?tab=details&kind=quality&q=Stage+2+review&search=Data+gap&issue=missing_image", { waitUntil: "networkidle" });
  await expect(page.getByTestId("data-details").locator("tbody tr")).toHaveCount(3);
  await expect(page.getByTestId("data-details").locator("tbody tr").filter({ hasText: "Data gap" })).not.toContainText("无图片");
  expect(fixture(db => db.prepare("SELECT * FROM CollectionTaskState WHERE id LIKE 'stage2-%' ORDER BY id").all())).toEqual(before);
});
