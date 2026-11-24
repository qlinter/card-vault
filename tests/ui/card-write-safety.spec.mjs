import { expect, test } from "@playwright/test";
import { withUiDatabase as fixture } from "./database-fixture.mjs";

test.beforeEach(() => fixture(db => db.exec(`
  INSERT INTO Card(id,playerName,cardTitle,sport,notes,holdingQuantity) VALUES('write-ui','Write UI Player','Original title','Basketball','Original note',1);
  INSERT INTO CardImage(id,cardId,path) VALUES('write-ui-image','write-ui','/media/ui-card-1.webp');
`)));
test.afterEach(() => fixture(db => {
  db.prepare("DELETE FROM Card WHERE id='write-ui' OR playerName='Write Retry Player'").run();
  db.prepare("DELETE FROM CardEntryDraft WHERE valuesJson LIKE '%Write Retry Player%'").run();
}));

for (const locale of ["zh", "en"]) test(`stale editors preserve inputs and files without overwriting newer archives (${locale})`, async ({ page, context, baseURL }) => {
  if (locale === "en") await context.addCookies([{ name: "card_vault_ui_locale", value: "en", url: baseURL }]);
  const other = await context.newPage();
  try {
    await page.goto("/cards/write-ui/edit", { waitUntil: "networkidle" });
    await other.goto("/cards/write-ui/edit", { waitUntil: "networkidle" });
    const first = page.locator(".entry-page > form"), stale = other.locator(".entry-page > form");
    const save = locale === "en" ? "Save Changes" : "保存修改";
    await stale.locator('[name="playerName"]').fill("Unsaved player");
    await stale.locator('[name="notes"]').fill("Unsaved note");
    await stale.locator('[name="images"]').setInputFiles({ name: "unsaved.png", mimeType: "image/png", buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64") });
    const newFront = stale.locator(".card-image-editor").first().locator(".card-front-choice");
    await newFront.click();
    await first.locator('[name="cardTitle"]').fill("Latest saved title");
    await first.getByRole("button", { name: save, exact: true }).click();
    await expect(page).toHaveURL(/\/cards\/write-ui\?success=updated/);
    for (let attempt = 0; attempt < 2; attempt++) {
      await stale.getByRole("button", { name: save, exact: true }).click();
      await expect(stale.locator(".note-error")).toContainText(locale === "en" ? "latest changes were not overwritten" : "未覆盖最新内容");
      await expect(stale.locator('[name="playerName"]')).toHaveValue("Unsaved player");
      await expect(stale.locator('[name="notes"]')).toHaveValue("Unsaved note");
      expect(await stale.locator('[name="images"]').evaluate(input => input.files.length)).toBe(1);
      await expect(newFront).toHaveAttribute("aria-pressed", "true");
      expect(fixture(db => db.prepare("SELECT playerName,cardTitle,notes FROM Card WHERE id='write-ui'").get())).toMatchObject({ playerName: "Write UI Player", cardTitle: "Latest saved title", notes: "Original note" });
      expect(fixture(db => db.prepare("SELECT count(*) n FROM CardImage WHERE cardId='write-ui'").get().n)).toBe(1);
    }
    await other.reload({ waitUntil: "networkidle" });
    await expect(stale.locator('[name="cardTitle"]')).toHaveValue("Latest saved title");
    await stale.locator('[name="notes"]').fill("Reviewed new note");
    await stale.getByRole("button", { name: save, exact: true }).click();
    await expect(other).toHaveURL(/\/cards\/write-ui\?success=updated/);
    expect(fixture(db => db.prepare("SELECT cardTitle,notes FROM Card WHERE id='write-ui'").get())).toMatchObject({ cardTitle: "Latest saved title", notes: "Reviewed new note" });
  } finally { await other.close(); }
});

test("a replacement front retains the back even with all five image slots in use", async ({ page }) => {
  fixture(db => {
    db.prepare("UPDATE CardImage SET path='/media/old-front.webp', createdAt=1 WHERE id='write-ui-image'").run();
    for (let i = 1; i <= 4; i++) {
      db.prepare("INSERT INTO CardImage(id,cardId,path,createdAt) VALUES(?, 'write-ui', ?, ?)").run(`back-${i}`, `/media/back-${i}.webp`, i + 1);
    }
  });
  await page.goto("/cards/write-ui/edit");
  await page.locator('input[name="images"]').setInputFiles("tests/fixtures/ui-media/showcase-bg.webp");
  await page.locator(".card-image-editor").first().getByRole("button", { name: "设为首图" }).click();
  await page.locator('[name="removeImageIds"][value="write-ui-image"]').check();
  await page.getByRole("button", { name: "保存修改", exact: true }).click();
  await expect(page).toHaveURL(/\/cards\/write-ui\?success=updated/);
  const images = fixture(db => db.prepare("SELECT id,path FROM CardImage WHERE cardId='write-ui' ORDER BY sortOrder,createdAt,id").all());
  expect(images).toHaveLength(5);
  expect(images[0].id).not.toBe("write-ui-image");
  expect(images[0].path).not.toBe("/media/old-front.webp");
  expect(images.slice(1).map(image => image.path)).toEqual([1, 2, 3, 4].map(i => `/media/back-${i}.webp`));
});

test("selecting a front survives a draft reload and can be changed without deleting images", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/cards/new", { waitUntil: "networkidle" });
  await page.locator('[name="playerName"]').fill("Write Retry Player");
  await page.locator('[name="cardTitle"]').fill("Front choice");
  await page.locator('[name="sport"]').fill("Basketball");
  const picture = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");
  await page.locator('[data-card-entry-form] [name="images"]').setInputFiles(["back.png", "graded-front.png"].map(name => ({ name, mimeType: "image/png", buffer: picture })));
  const previews = page.locator(".card-image-edit-item");
  await expect(previews.first().getByRole("button", { pressed: true })).toHaveText(/首图/);
  await previews.nth(1).getByRole("button", { name: "设为首图" }).click();
  await previews.nth(1).getByRole("button", { name: /向右旋转/ }).click();
  const savedDraft = () => fixture(db => db.prepare("SELECT id FROM CardEntryDraft WHERE json_extract(valuesJson,'$.frontChoice')='new:1' AND valuesJson LIKE '%Write Retry Player%'").get()?.id);
  await expect.poll(savedDraft).toBeTruthy();
  await page.goto("/cards/new?draft=" + savedDraft());
  await expect(previews.nth(1).getByRole("button", { pressed: true })).toBeVisible();
  expect(await previews.nth(1).evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  await page.getByRole("button", { name: "保存并查看", exact: true }).click();
  await expect(page).toHaveURL(/\/cards\/[^/]+\?success=created/);
  const cardId = new URL(page.url()).pathname.split("/").pop();
  const orderedImages = () => fixture(db => db.prepare("SELECT id, rotation FROM CardImage WHERE cardId=? ORDER BY sortOrder,createdAt,id").all(cardId));
  const originals = orderedImages();
  expect(originals.map(image => image.rotation)).toEqual([90, 0]);
  await page.goto("/cards/" + cardId + "/edit");
  await previews.nth(1).getByRole("button", { name: "设为首图" }).click();
  await page.getByRole("button", { name: "保存修改" }).click();
  await expect(page).toHaveURL(/success=updated/);
  expect(orderedImages()).toEqual(originals.reverse());
});

test("a failed draft sync preserves a new entry and cannot commit under a different retry identity", async ({ page }) => {
  let writes = 0;
  page.on("request", request => { if (request.method() === "POST" && new URL(request.url()).pathname === "/cards/new") writes++; });
  await page.route("**/api/card-entry/drafts", route => route.fulfill({ status: 503, json: { error: "草稿保存暂不可用，请重试。" } }));
  await page.goto("/cards/new", { waitUntil: "networkidle" });
  await page.locator('[name="playerName"]').fill("Write Retry Player");
  await page.locator('[name="cardTitle"]').fill("Retry after draft failure");
  await page.locator('[name="sport"]').fill("Basketball");
  const imageInput = page.locator('[data-card-entry-form="true"] [name="images"]');
  await imageInput.setInputFiles("tests/fixtures/ui-media/showcase-bg.webp");
  await page.getByRole("button", { name: "保存并查看", exact: true }).click();
  await expect(page.locator(".entry-draft-status")).toContainText("草稿保存暂不可用");
  await expect(page.locator(".card-form-error")).toContainText("草稿保存暂不可用");
  await expect(page.locator(".card-form-error")).toBeInViewport();
  await expect(page.locator(".card-form-error")).toBeFocused();
  await page.waitForLoadState("networkidle");
  expect(writes).toBe(0);
  expect(fixture(db => db.prepare("SELECT count(*) n FROM Card WHERE playerName='Write Retry Player'").get().n)).toBe(0);
  await expect(page.locator('[name="cardTitle"]')).toHaveValue("Retry after draft failure");
  expect(await imageInput.evaluate(input => input.files.length)).toBe(1);
  await page.unroute("**/api/card-entry/drafts");
  await page.getByRole("button", { name: "保存并查看", exact: true }).click();
  await expect(page).toHaveURL(/\/cards\/[^/]+\?success=created/);
  expect(writes).toBe(1);
  expect(fixture(db => db.prepare("SELECT count(*) n FROM Card WHERE playerName='Write Retry Player'").get().n)).toBe(1);
});

for (const locale of ["zh", "en"]) test(`stale deletion keeps updated archives and permits a fresh confirmation (${locale})`, async ({ page, context, baseURL }) => {
  if (locale === "en") await context.addCookies([{ name: "card_vault_ui_locale", value: "en", url: baseURL }]);
  // This fixture shares its image with other tests; remove only the reference here.
  fixture(db => db.prepare("DELETE FROM CardImage WHERE cardId='write-ui'").run());
  await page.goto("/cards/write-ui/delete", { waitUntil: "networkidle" });
  fixture(db => db.prepare("UPDATE Card SET cardTitle='Changed after opening confirmation' WHERE id='write-ui'").run());
  const button = locale === "en" ? "Confirm Deletion" : "确认删除";
  await page.getByRole("button", { name: button, exact: true }).click();
  await expect(page).toHaveURL(/\/cards\/write-ui\?error=/);
  await expect(page.locator(".note-error")).toContainText(locale === "en" ? "Nothing was deleted" : "未执行删除");
  expect(fixture(db => db.prepare("SELECT cardTitle FROM Card WHERE id='write-ui'").get()).cardTitle).toBe("Changed after opening confirmation");
  await page.goto("/cards/write-ui/delete", { waitUntil: "networkidle" });
  await expect(page.getByText("Changed after opening confirmation", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: button, exact: true }).click();
  await expect(page).toHaveURL(/success=deleted/);
  expect(fixture(db => db.prepare("SELECT id FROM Card WHERE id='write-ui'").get())).toBeUndefined();
});
