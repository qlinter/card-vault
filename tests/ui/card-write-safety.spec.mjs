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

test("conflicting draft autosaves offer reload or an independent copy with its photos", async ({ page, context }) => {
  const title = page.locator('[name="cardTitle"]');
  const images = '[data-card-entry-form] [name="images"]';
  await page.goto("/cards/new");
  await page.locator('[name="playerName"]').fill("Write Retry Player");
  await title.fill("Original draft");
  await page.locator(images).setInputFiles("tests/fixtures/ui-media/showcase-bg.webp");
  await page.waitForURL(url => url.searchParams.has("draft"));
  const url = page.url(), original = new URL(url).searchParams.get("draft");
  const read = id => fixture(db => JSON.parse(db.prepare("SELECT valuesJson FROM CardEntryDraft WHERE id=?").get(id).valuesJson));
  await expect.poll(() => read(original).draftImages.length).toBe(1);
  const copy = await context.newPage(), reload = await context.newPage();
  for (const tab of [copy, reload]) {
    await tab.goto(url);
    await expect(tab.locator(images)).toHaveAttribute("data-draft-restored", "restored");
  }
  await title.fill("Latest title");
  await expect.poll(() => read(original).cardTitle).toBe("Latest title");
  for (const tab of [copy, reload]) {
    await tab.locator('[name="playerName"]').fill("Write Retry Player copy");
    await expect(tab.getByRole("button",{name:"载入最新草稿"})).toBeVisible();
    await expect(tab.getByRole("button",{name:"保存并查看"})).toBeDisabled();
  }
  await reload.getByRole("button",{name:"载入最新草稿"}).click();
  await expect(reload.locator('[name="cardTitle"]')).toHaveValue("Latest title");
  await copy.getByRole("button",{name:"另存为新草稿"}).click();
  await copy.waitForURL(u => u.searchParams.has("draft") && u.searchParams.get("draft") !== original);
  const fork = new URL(copy.url()).searchParams.get("draft");
  expect(read(fork).cardTitle).toBe("Original draft");
  expect(read(fork).playerName).toBe("Write Retry Player copy");
  expect(read(fork).draftImages[0].path).not.toBe(read(original).draftImages[0].path);
  expect(read(original).playerName).toBe("Write Retry Player");
  await copy.locator('[name="cardTitle"]').fill("Independent edit");
  await expect.poll(() => read(fork).cardTitle).toBe("Independent edit");
  expect(read(original).cardTitle).toBe("Latest title");
});

for (const extraFront of [false,true]) test(`resume queue photos and rotations through the draft list (extra front: ${extraFront})`, async ({page,context}) => {
  fixture(db => db.exec(`
    INSERT INTO CardEntryBatch(id) VALUES('resume-batch');
    INSERT INTO CardEntryQueueItem(id,batchId,status) VALUES('resume-queue','resume-batch','ready');
    INSERT INTO CardEntryQueueImage(id,itemId,originalName,processedPath,side,sortOrder,mimeType,originalBytes)
    VALUES('resume-front','resume-queue','f.webp','/media/ui-card-1.webp','front',0,'image/webp',200),
          ('resume-back','resume-queue','b.webp','/media/ui-card-2.webp','back',1,'image/webp',200);`));
  try {
    await page.goto("/cards/new?queue=resume-queue");
    await page.locator('[name="playerName"]').fill("Write Retry Player");
    await page.locator('[name="cardTitle"]').fill("Three draft photos");
    await page.locator('[name="sport"]').fill("Football");
    await page.locator('[data-card-entry-form] [name="images"]').setInputFiles("tests/fixtures/ui-media/shares-bg.webp");
    const findImage = (tab,alt) => tab.locator(".card-image-edit-item").filter({has:tab.getByRole("button",{name:alt})});
    const back = findImage(page,/队列第 2 张图片向右旋转/);
    await back.getByRole("button",{name:/向右旋转/}).click();
    const extra = findImage(page,/第 1 张新增图片向右旋转/);
    await extra.getByRole("button",{name:/向左旋转/}).click();
    await (extraFront ? extra : back).getByRole("button",{name:"设为首图"}).click();
    await page.waitForURL(u => u.searchParams.has("draft"));
    const id = new URL(page.url()).searchParams.get("draft");
    const read = () => fixture(db=>JSON.parse(db.prepare("SELECT valuesJson FROM CardEntryDraft WHERE id=?").get(id).valuesJson));
    await expect.poll(()=>[read().queueItemId,read().frontChoice,read().queuedImageRotations?.["resume-back"],read().draftImages[0]?.rotation]).toEqual(["resume-queue",extraFront ? "new:0" : "queued:resume-back",90,270]);
    const reopened = await context.newPage();
    await reopened.goto("/cards/new?queue=resume-queue");
    await expect(reopened.locator('[name="cardTitle"]')).toHaveValue("Three draft photos");
    await reopened.goto("/cards/new");
    await reopened.locator(".entry-draft-panel > summary").click();
    await reopened.locator(".entry-draft-item a").filter({hasText:"Three draft photos"}).click();
    await expect(reopened.locator(".card-image-edit-item")).toHaveCount(3);
    await expect(findImage(reopened,extraFront ? /第 1 张新增图片向右旋转/ : /队列第 2 张图片向右旋转/).getByRole("button",{pressed:true})).toBeVisible();
    await reopened.getByRole("button",{name:"保存并查看",exact:true}).click();
    await expect(reopened).toHaveURL(/success=created/);
    const cardId=new URL(reopened.url()).pathname.split("/").pop();
    const photos=fixture(db=>db.prepare("SELECT path,rotation FROM CardImage WHERE cardId=? ORDER BY sortOrder").all(cardId));
    expect(photos.map(photo=>photo.rotation)).toEqual(extraFront ? [270,0,90] : [90,0,270]);
    expect(photos.find(photo=>photo.rotation===0).path).toBe("/media/ui-card-1.webp");
    expect(photos.find(photo=>photo.rotation===90).path).toBe("/media/ui-card-2.webp");
    expect(fixture(db=>db.prepare("SELECT count(*) n FROM CardEntryQueueItem WHERE id='resume-queue'").get().n)).toBe(0);
    expect(fixture(db=>db.prepare("SELECT count(*) n FROM CardEntryDraft WHERE id=?").get(id).n)).toBe(0);
  } finally { fixture(db => db.prepare("DELETE FROM CardEntryBatch WHERE id='resume-batch'").run()); }
});

test("a legacy queue front locates the queue, and a missing queue never commits only the extra images", async ({page}) => {
  fixture(db => {
    db.exec(`INSERT INTO CardEntryBatch(id) VALUES('legacy-queue-batch');
      INSERT INTO CardEntryQueueItem(id,batchId,status) VALUES('legacy-queue','legacy-queue-batch','ready');
      INSERT INTO CardEntryQueueImage(id,itemId,originalName,processedPath,mimeType,originalBytes)
      VALUES('legacy-front','legacy-queue','front.webp','/media/ui-card-1.webp','image/webp',200);`);
    db.prepare("INSERT INTO CardEntryDraft(id,valuesJson) VALUES(?,?)").run("legacy-queue-draft",JSON.stringify({
      playerName:"Write Retry Player",cardTitle:"Legacy queue front",sport:"Football",frontChoice:"queued:legacy-front",draftImages:[]
    }));
  });
  try {
    await page.goto("/cards/new?draft=legacy-queue-draft");
    await expect(page.locator('[name="queueItemId"]')).toHaveValue("legacy-queue");
    await expect(page.getByRole("button",{pressed:true})).toContainText("首图");
    await page.goto("/cards/new?queue=legacy-queue");
    await expect(page.locator('[name="draftId"]')).toHaveValue("legacy-queue-draft");
    await page.locator('[data-card-entry-form] [name="images"]').setInputFiles("tests/fixtures/ui-media/shares-bg.webp");
    await expect.poll(()=>fixture(db=>JSON.parse(db.prepare("SELECT valuesJson FROM CardEntryDraft WHERE id='legacy-queue-draft'").get().valuesJson).draftImages.length)).toBe(1);
    fixture(db=>db.prepare("DELETE FROM CardEntryBatch WHERE id='legacy-queue-batch'").run());
    await page.getByRole("button",{name:"保存并查看",exact:true}).click();
    await expect(page.locator(".card-form-error")).toContainText("队列项目不存在");
    expect(fixture(db=>db.prepare("SELECT COUNT(*) n FROM Card WHERE cardTitle='Legacy queue front'").get().n)).toBe(0);
    await page.goto("/cards/new?draft=legacy-queue-draft");
    await expect(page.locator(".entry-page").getByRole("alert")).toContainText("草稿关联的队列图片不可用");
    await expect(page.getByRole("button",{name:"保存并查看"})).toHaveCount(0);
    expect(fixture(db=>db.prepare("SELECT COUNT(*) n FROM CardEntryDraft WHERE id='legacy-queue-draft'").get().n)).toBe(1);
  } finally { fixture(db=>db.prepare("DELETE FROM CardEntryBatch WHERE id='legacy-queue-batch'").run()); }
});

test("stale draft deletion requires review of every intervening save", async ({page,context}) => {
  await page.goto("/cards/new");
  await page.locator('[name="playerName"]').fill("Write Retry Player");
  const title = page.locator('[name="cardTitle"]');
  await title.fill("Original entry");
  await page.locator('[data-card-entry-form] [name="images"]').setInputFiles("tests/fixtures/ui-media/showcase-bg.webp");
  await page.waitForURL(url => url.searchParams.has("draft"));
  const id=new URL(page.url()).searchParams.get("draft");
  const current = () => fixture(db=>db.prepare("SELECT valuesJson FROM CardEntryDraft WHERE id=?").get(id));
  await expect.poll(()=>JSON.parse(current().valuesJson).draftImages.length).toBe(1);
  const list=await context.newPage();
  await list.goto("/cards/new");
  await list.locator(".entry-draft-panel > summary").click();
  const row=list.locator(".entry-draft-item").filter({has:list.locator(`a[href*="${id}"]`)});
  await title.fill("First revision");
  await expect.poll(()=>JSON.parse(current().valuesJson).cardTitle).toBe("First revision");
  await row.getByRole("button",{name:/删除草稿/}).click();
  await expect(row).toContainText("First revision");
  await expect(row.locator("time")).toBeVisible();
  await row.getByRole("button",{name:"取消"}).click();
  await expect(row.getByRole("button",{name:/删除草稿/})).toBeVisible();
  await title.fill("Second revision");
  await expect.poll(()=>JSON.parse(current().valuesJson).cardTitle).toBe("Second revision");
  await row.getByRole("button",{name:/删除草稿/}).click();
  await expect(row).toContainText("Second revision");
  await title.fill("Third revision");
  await expect.poll(()=>JSON.parse(current().valuesJson).cardTitle).toBe("Third revision");
  await row.getByRole("button",{name:"确认删除",exact:true}).click();
  await expect(row).toContainText("Third revision");
  const mediaPath=JSON.parse(current().valuesJson).draftImages[0].path;
  expect((await list.request.get(mediaPath)).status()).toBe(200);
  await row.getByRole("button",{name:"确认删除",exact:true}).click();
  await expect(row).toHaveCount(0);
  expect(current()).toBeUndefined();
  expect((await list.request.get(mediaPath)).status()).toBe(404);
});

test("a conflicting queue draft can be saved separately with its queue photos", async ({page,context}) => {
  fixture(db => db.exec(`
    INSERT INTO CardEntryBatch(id) VALUES('draft-copy-batch');
    INSERT INTO CardEntryQueueItem(id,batchId,status) VALUES('draft-copy-queue','draft-copy-batch','ready');
    INSERT INTO CardEntryQueueImage(id,itemId,originalName,processedPath,side,sortOrder,mimeType,originalBytes)
    VALUES('copy-front','draft-copy-queue','front.webp','/media/ui-card-1.webp','front',0,'image/webp',200),
          ('copy-back','draft-copy-queue','back.webp','/media/ui-card-2.webp','back',1,'image/webp',200);`));
  try {
    await page.goto("/cards/new?queue=draft-copy-queue");
    await page.locator('[name="playerName"]').fill("Write Retry Player");
    await page.waitForURL(url => url.searchParams.has("draft"));
    const original = new URL(page.url()).searchParams.get("draft");
    const copy = await context.newPage(); await copy.goto(page.url());
    await page.locator('[name="cardTitle"]').fill("Latest queued title");
    await expect.poll(() => fixture(db => JSON.parse(db.prepare("SELECT valuesJson FROM CardEntryDraft WHERE id=?").get(original).valuesJson).cardTitle)).toBe("Latest queued title");
    await copy.getByRole("button",{name:"设为首图"}).click();
    await copy.getByRole("button",{name:"另存为新草稿"}).click();
    await copy.waitForURL(url => url.searchParams.has("draft") && !url.searchParams.has("queue"));
    const fork = new URL(copy.url()).searchParams.get("draft");
    const values = fixture(db => JSON.parse(db.prepare("SELECT valuesJson FROM CardEntryDraft WHERE id=?").get(fork).valuesJson));
    expect(values.frontChoice).toBe("new:1");
    expect(values.draftImages.map(photo => photo.name)).toEqual(["front.webp","back.webp"]);
    expect(fixture(db => db.prepare("SELECT status FROM CardEntryQueueItem WHERE id='draft-copy-queue'").get().status)).toBe("ready");
  } finally { fixture(db => db.prepare("DELETE FROM CardEntryBatch WHERE id='draft-copy-batch'").run()); }
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
