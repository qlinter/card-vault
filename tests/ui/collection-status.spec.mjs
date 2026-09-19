import { expect, test } from "@playwright/test";
import { DatabaseSync } from "node:sqlite";
import path from "node:path";

const statuses = ["holding", "pending_grading", "grading", "listed", "sold"];
const labels = ["持有", "待送评", "送评中", "待售", "已售"];
function fixture(action) {
  const db = new DatabaseSync(path.resolve("tests/.ui-test-runtime/data/dev.db"));
  try { db.exec("PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000"); return action(db); } finally { db.close(); }
}
test.afterEach(async ({ page, request, baseURL }) => {
  const draft = new URL(page.url()).searchParams.get("draft");
  await page.goto("about:blank");
  if (draft) await request.delete(`/api/card-entry/drafts/${draft}`, { headers: { Origin: baseURL } });
  fixture(db => {
    db.prepare("UPDATE Card SET collectionStatus='holding' WHERE id='ui-card-1'").run();
    db.prepare("DELETE FROM Card WHERE cardTitle='Collection status test'").run();
  });
});

test("status filters and editors share the owned order and preserve quantity and valuation", async ({ page }) => {
  for (const [index, status] of statuses.slice(0, 4).entries()) {
    await page.goto("/cards/ui-card-1/edit", { waitUntil: "networkidle" });
    const select = page.locator('[name="collectionStatus"]');
    await expect(select.locator("option")).toHaveText(labels);
    await select.selectOption(status);
    await page.getByRole("button", { name: "保存修改", exact: true }).click();
    await expect(page).toHaveURL(/\/cards\/ui-card-1\?success=/);
    await expect(page.locator(".details")).toContainText(labels[index]);
    await page.goto(`/?collectionStatus=${status}&q=Jordan`, { waitUntil: "networkidle" });
    await expect(page.locator('[name="collectionStatus"] option')).toHaveText(["收藏状态", ...labels]);
    await expect(page.locator(".valuation-total-list")).toContainText("3,760");
    expect(fixture(db => db.prepare("SELECT quantity, valueMinor FROM CardReport WHERE cardId='ui-card-1'").get())).toEqual({ quantity: 2, valueMinor: 376000 });
  }
  await page.goto("/portfolio", { waitUntil: "networkidle" });
  const overview = page.locator('[aria-label="组合概览"]');
  await expect(overview.locator("article").nth(2)).toContainText("50%");
  await expect(overview.locator("article").nth(2)).toContainText("1/2");
  await page.goto("/portfolio?collectionStatus=pending_grading", { waitUntil: "networkidle" });
  await expect(page.locator("body")).not.toContainText("目标卡");
  await page.goto("/cards/ui-card-1/edit", { waitUntil: "networkidle" });
  await page.locator('[name="collectionStatus"]').selectOption("sold");
  await page.getByRole("button", { name: "保存修改", exact: true }).click();
  await expect(page.locator(".note-error")).toContainText("已售卡片的持有数量必须为 0");
  expect(fixture(db => db.prepare("SELECT holdingQuantity, collectionStatus FROM Card WHERE id='ui-card-1'").get())).toEqual({ holdingQuantity: 2, collectionStatus: "listed" });
  await page.goto("/cards/ui-card-3/edit", { waitUntil: "networkidle" });
  await page.locator('[name="collectionStatus"]').selectOption("pending_grading");
  await page.getByRole("button", { name: "保存修改", exact: true }).click();
  await expect(page.locator(".note-error")).toContainText("卡片数量至少为 1");
});

test("awaiting-grading entry saves its physical purchase and restores its status in the editor", async ({ page }) => {
  await page.goto("/cards/new", { waitUntil: "networkidle" });
  await expect(page.locator('[name="collectionStatus"] option')).toHaveText(labels);
  await page.locator('[name="playerName"]').fill("Status Player");
  await page.locator('[name="cardTitle"]').fill("Collection status test");
  await page.locator('[name="sport"]').fill("Basketball");
  await page.locator('[name="collectionStatus"]').selectOption("pending_grading");
  await expect(page.locator('[name="initialQuantity"]')).toHaveValue("1");
  await page.locator('[name="initialQuantity"]').fill("3");
  await page.locator('[name="purchaseDate"]').fill("2026-01-01");
  await page.locator('[name="purchasePrice"]').fill("300");
  await page.locator('[data-card-entry-form="true"] input[name="images"]').setInputFiles({ name: "card.png", mimeType: "image/png", buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=", "base64") });
  await page.getByRole("button", { name: "保存并查看", exact: true }).click();
  await expect(page).toHaveURL(/\/cards\/[^/?]+\?success=/);
  const saved = fixture(db => db.prepare("SELECT id, collectionStatus, holdingQuantity FROM Card WHERE cardTitle='Collection status test'").get());
  expect(saved.collectionStatus).toBe("pending_grading");
  expect(saved.holdingQuantity).toBe(3);
  expect(fixture(db => db.prepare("SELECT quantity, amountMinor FROM CardTransaction WHERE cardId=?").get(saved.id))).toEqual({ quantity: 3, amountMinor: 30000 });
  await page.goto(`/cards/${saved.id}/edit`, { waitUntil: "networkidle" });
  await expect(page.locator('[name="collectionStatus"]')).toHaveValue("pending_grading");
});
