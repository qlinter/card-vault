const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const sharp = require("sharp");
const { DatabaseSync } = require("node:sqlite");
const { chromium } = require("@playwright/test");
const { fileDatabaseUrl, findAvailablePort, initializeTestDatabase, removeTempRoot, startTestServer, stopServer, waitForServer } = require("./test-http-flow-utils");

function cardSvg(width, height, color, name, number, slab = false) {
  const inset = slab ? 34 : 16;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <rect width="100%" height="100%" rx="${slab ? 22 : 3}" fill="${slab ? "#c9cfcb" : "#e6dcc7"}"/>
    <rect x="${inset}" y="${slab ? 108 : 16}" width="${width - inset * 2}" height="${height - (slab ? 142 : 32)}" fill="${color}"/>
    ${slab ? `<rect x="34" y="25" width="${width - 68}" height="60" fill="#f1eee4"/><rect x="34" y="25" width="${width - 68}" height="7" fill="#ab5042"/><text x="${width / 2}" y="66" text-anchor="middle" font-family="Arial" font-size="25" fill="#333">GRADED 10 · 000123</text>` : ""}
    <path d="M${inset} ${height * .65} ${width - inset} ${height * .25}V${height - inset}H${inset}Z" fill="#132e34" opacity=".5"/>
    <circle cx="${width * .53}" cy="${height * .35}" r="${height * .065}" fill="#e2d8be" opacity=".55"/>
    <path d="M${width * .42} ${height * .44}Q${width * .53} ${height * .37} ${width * .64} ${height * .44}L${width * .72} ${height * .73}H${width * .35}Z" fill="#e2d8be" opacity=".36"/>
    <text x="${width / 2}" y="${height * .71}" text-anchor="middle" fill="#f3e9d2" font-size="${height * .25}" font-family="Georgia" font-style="italic">${number}</text>
    <text x="${width / 2}" y="${height * .88}" text-anchor="middle" fill="#f3e9d2" font-size="${width * .04}" font-family="Arial" letter-spacing="4">${name}</text>
    <rect x="${inset}" y="${height - inset - 12}" width="${width - inset * 2}" height="12" fill="#dfc999"/>
  </svg>`;
}

async function assertImagesFit(page) {
  await page.waitForFunction(() => [...document.querySelectorAll(".showcase-media-image")].every(image => {
    if (!image.complete || !image.naturalWidth) return true;
    if (image.dataset.fitted !== "true") return false;
    const frame = image.parentElement.getBoundingClientRect(), bounds = image.getBoundingClientRect();
    return bounds.left >= frame.left - 1 && bounds.top >= frame.top - 1 && bounds.right <= frame.right + 1 && bounds.bottom <= frame.bottom + 1;
  }));
  const failures = await page.locator(".showcase-media-image:visible").evaluateAll(images => images.flatMap(image => {
    if (image.dataset.fitted !== "true") return [];
    const frame = image.parentElement.getBoundingClientRect(), bounds = image.getBoundingClientRect();
    return bounds.left < frame.left - 1 || bounds.top < frame.top - 1 || bounds.right > frame.right + 1 || bounds.bottom > frame.bottom + 1 ? [image.src] : [];
  }));
  assert.deepEqual(failures, [], "complete rotated image bounds must fit the reserved frame");
}

async function main() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "card-vault-showcase-"));
  const data = path.join(root, "data"), database = path.join(data, "dev.db"), uploads = path.join(data, "uploads");
  const env = { ...process.env, CARD_VAULT_DATA_DIR: data, DATABASE_URL: fileDatabaseUrl(database), NODE_ENV: "production" };
  const port = await findAvailablePort(3395), base = `http://127.0.0.1:${port}`, output = [], browserErrors = [];
  let db, browser, server;
  try {
    initializeTestDatabase(env);
    fs.mkdirSync(uploads, { recursive: true });
    fs.mkdirSync("logs", { recursive: true });
    for (const [file, width, height, color, name, number, slab] of [
      ["slab", 660, 1100, "#38604c", "JORDAN LEE", "23", true],
      ["portrait", 600, 840, "#a46743", "ALEX MORGAN", "13", false],
      ["landscape", 1000, 700, "#3c7186", "RACING TEAM 27", "27", false],
      ["reverse", 600, 840, "#7e795b", "HERITAGE / 2024", "99", false]
    ]) await sharp(Buffer.from(cardSvg(width, height, color, name, number, slab))).webp().toFile(path.join(uploads, `${file}.webp`));
    db = new DatabaseSync(database);
    db.exec("PRAGMA foreign_keys=ON; PRAGMA busy_timeout=30000");
    const insert = db.prepare("INSERT INTO Card(id,playerName,cardTitle,sport,year,brand,productLine,parallel,serialNumber,serialRange,gradingCompany,grade,publicDescription,notes) VALUES(?,?,?,'Basketball','2024','Aurora','Championship',?,?,?,?,?,?,'PRIVATE-NOTE-MUST-NOT-LEAK')");
    insert.run("slab", "Jordan Lee", "Championship Rookie Auto", "Teal", "08", "/99", "PSA", "10", "第一张入藏的签名卡。\n留下那个赛季的记忆。");
    insert.run("portrait", "Alex Morgan", "Spotlight Patch", "Gold", "12", "/25", null, null, null);
    insert.run("landscape", "Racing Team 27", "Victory Lap", null, null, "/50", "BGS", "9.5", "A memorable race.");
    insert.run("empty", "No image", "A very long title ".repeat(14), null, null, null, null, null, null);
    insert.run("broken", "Broken image", "Image recovery", null, null, null, null, null, null);
    const image = db.prepare("INSERT INTO CardImage(id,cardId,path,rotation,createdAt) VALUES(?,?,?,?,?)");
    image.run("slab-front", "slab", "/media/slab.webp", 0, 1000);
    image.run("slab-back", "slab", "/media/reverse.webp", 90, 2000);
    image.run("slab-third", "slab", "/media/landscape.webp", 180, 3000);
    image.run("slab-fourth", "slab", "/media/portrait.webp", 270, 4000);
    image.run("slab-fifth", "slab", "/media/reverse.webp", 0, 5000);
    image.run("portrait", "portrait", "/media/portrait.webp", 0, 1000);
    image.run("landscape", "landscape", "/media/landscape.webp", 0, 1000);
    image.run("broken", "broken", "/media/missing.webp", 0, 1000);
    server = startTestServer(port, env, output);
    await waitForServer(base, output, server, "Showcase");
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, locale: "zh-CN", reducedMotion: "reduce" });
    page.on("pageerror", error => browserErrors.push(error.message));
    page.setDefaultTimeout(15_000);
    await page.goto(`${base}/showcase`, { waitUntil: "networkidle" });
    const subjectWidth = await page.locator(".showcase-group-row .showcase-chip").first().evaluate(element => element.getBoundingClientRect().width);
    assert.ok(subjectWidth <= 140, `subject selector should stay compact at desktop width, got ${subjectWidth}px`);
    const selectedSubjectStyle = await page.locator(".showcase-chip.active").evaluate(element => ({
      background: getComputedStyle(element).backgroundColor,
      border: getComputedStyle(element).borderTopColor,
      shadow: getComputedStyle(element).boxShadow
    }));
    assert.deepEqual(selectedSubjectStyle, { background: "rgba(0, 0, 0, 0)", border: "rgba(0, 0, 0, 0)", shadow: "none" }, "selected subject only deepens the text");
    assert.match(await page.locator(".showcase-card-stage img").first().getAttribute("src"), /^\/thumbnails\//, "wall loads a compact image");
    const withoutJavaScript = await browser.newPage({ javaScriptEnabled: false, viewport: { width: 1440, height: 1000 } });
    await withoutJavaScript.goto(`${base}/showcase`, { waitUntil: "networkidle" });
    const firstPaint = await withoutJavaScript.locator(".showcase-card-stage img").first().evaluate(image => ({ loaded: image.complete && image.naturalWidth > 0, opacity: getComputedStyle(image).opacity, shadow: getComputedStyle(image).boxShadow }));
    assert.deepEqual(firstPaint, { loaded: true, opacity: "1", shadow: "none" }, "first wall image is visible without a shadow around its unfitted container");
    await withoutJavaScript.close();
    assert.equal(await page.locator(".showcase-page").evaluate(element => getComputedStyle(element).animationName), "none", "collection browsing does not fade the entire page");
    assert.equal(await page.locator(".showcase-card").count(), 5);
    await page.getByText("图片暂时无法显示", { exact: true }).waitFor();
    assert.equal(await page.locator(".showcase-image-placeholder").count(), 2);
    assert.ok(!(await page.content()).includes("PRIVATE-NOTE-MUST-NOT-LEAK"));
    for (const width of [1100, 1440, 1920]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.waitForFunction(() => [...document.querySelectorAll('.showcase-media-image')].filter(image => image.complete && image.naturalWidth).every(image => image.dataset.fitted === "true"));
      await assertImagesFit(page);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.screenshot({ path: `logs/v1.4.2-showcase-wall-${width}.png`, fullPage: true, animations: "disabled" });
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.getByRole("button", { name: "列表视图", exact: true }).click();
    await page.reload({ waitUntil: "networkidle" });
    assert.equal(await page.locator(".showcase-views.is-list").count(), 1);
    await assertImagesFit(page);
    await page.screenshot({ path: "logs/v1.4.2-showcase-list.png", fullPage: true, animations: "disabled" });
    await page.getByRole("button", { name: "卡片视图", exact: true }).click();
    await page.locator('.showcase-chip[title="Jordan Lee"]').click();
    await page.locator('.showcase-card[href*="/slab?"]').click();
    assert.ok(page.url().includes("group=Jordan"));
    await page.locator(".showcase-detail-main-frame img").waitFor();
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: "logs/v1.4.2-showcase-detail.png", fullPage: true, animations: "disabled" });
    assert.equal(await page.locator(".showcase-thumb-button").count(), 5);
    for (let index = 0; index < 4; index++) {
      await page.getByRole("button", { name: "向右旋转图片", exact: true }).click();
      await page.waitForFunction(() => document.querySelector('.showcase-detail-main-frame img').dataset.fitted === "true");
      await assertImagesFit(page);
    }
    const rotationBefore = db.prepare("SELECT rotation FROM CardImage WHERE id='slab-front'").get().rotation;
    assert.equal(rotationBefore, 0, "view rotation must not write to the database");
    await page.getByRole("button", { name: "查看第 2 张图片", exact: true }).click();
    await assertImagesFit(page);
    await page.getByRole("button", { name: "查看大图", exact: true }).click();
    await page.locator("dialog[open]").waitFor();
    await page.getByRole("button", { name: "放大图片", exact: true }).click();
    const dialog = page.getByRole("dialog");
    const zoomField = dialog.getByRole("spinbutton", { name: "缩放比例" });
    assert.equal(await zoomField.inputValue(), "150");
    assert.ok(await zoomField.evaluate(input => input.parentElement.getBoundingClientRect().width <= 66), "zoom field fits three digits and percent without excess width");
    assert.equal(await dialog.getByRole("button", { name: "重置缩放" }).count(), 0);
    await zoomField.focus();
    const focusFrames = await zoomField.evaluate(input => ({
      inputShadow: getComputedStyle(input).boxShadow,
      inputOutline: getComputedStyle(input).outlineStyle,
      outerShadow: getComputedStyle(input.parentElement).boxShadow,
      outerOutline: getComputedStyle(input.parentElement).outlineStyle
    }));
    assert.deepEqual(focusFrames, { inputShadow: "none", inputOutline: "none", outerShadow: "none", outerOutline: "none" }, "zoom input has a single quiet border while editing");
    await zoomField.fill("175");
    await zoomField.press("Enter");
    assert.equal(await zoomField.inputValue(), "175");
    assert.equal(await dialog.locator(".showcase-lightbox-canvas").evaluate(element => element.style.width), "175%");
    await zoomField.fill("650");
    await zoomField.press("Enter");
    assert.equal(await zoomField.inputValue(), "500");
    await zoomField.fill("75");
    await zoomField.press("Enter");
    assert.equal(await zoomField.inputValue(), "75");
    assert.equal(await dialog.locator(".showcase-lightbox-canvas").evaluate(element => element.style.width), "75%");
    await zoomField.fill("100");
    await zoomField.press("Enter");
    assert.equal(await zoomField.inputValue(), "100");
    await dialog.getByRole("button", { name: "放大图片" }).click();
    assert.ok(await dialog.locator(".showcase-lightbox-viewport").evaluate(element => element.scrollWidth > element.clientWidth && element.scrollHeight > element.clientHeight));
    await page.screenshot({ path: "logs/v1.4.2-showcase-lightbox.png", animations: "disabled" });
    await page.keyboard.press("ArrowRight");
    assert.equal(await dialog.locator(".showcase-image-counter").innerText(), "3 / 5");
    assert.equal(await zoomField.inputValue(), "100");
    await page.keyboard.press("+");
    await page.keyboard.press("0");
    assert.equal(await zoomField.inputValue(), "100");
    for (let index = 0; index < 12; index++) await page.keyboard.press("Tab");
    assert.ok(await page.evaluate(() => document.querySelector("dialog").contains(document.activeElement)), "modal focus remains inside the dialog");
    await page.keyboard.press("Escape");
    assert.equal(await page.locator("dialog[open]").count(), 0);
    assert.ok(await page.getByRole("button", { name: "查看大图", exact: true }).evaluate(button => document.activeElement === button), "closing the lightbox restores focus to its accessible icon button");
    await page.waitForFunction(() => document.body.style.overflow !== "hidden");
    assert.equal(await page.evaluate(() => document.body.style.overflow), "");
    await page.getByRole("link", { name: "返回展墙", exact: true }).click();
    await page.locator(".showcase-grid").waitFor();
    assert.ok(page.url().includes("group=Jordan"));
    assert.equal(await page.locator(".showcase-card").count(), 1);
    await page.goto(`${base}/showcase/cards/portrait`, { waitUntil: "networkidle" });
    assert.equal(await page.locator(".showcase-story").count(), 0);
    assert.equal(await page.locator(".showcase-detail-facts dd").filter({ hasText: /PSA/ }).count(), 0);
    await page.getByRole("button", { name: "查看大图", exact: true }).click();
    assert.equal(await page.locator("dialog .showcase-image-counter").count(), 0, "single-image lightbox omits its redundant counter");
    await page.keyboard.press("Escape");
    for (const theme of ["classic", "gallery", "midnight", "archive"]) {
      await page.context().addCookies([{ name: "card_vault_app_theme", value: theme, url: base }]);
      await page.goto(`${base}/showcase`, { waitUntil: "networkidle" });
      assert.equal(await page.locator("html").getAttribute("data-app-theme"), theme);
      assert.ok(Number(await page.locator(".site-bg").evaluate(element => getComputedStyle(element).opacity)) <= .12);
      await page.screenshot({ path: `logs/v1.4.2-showcase-theme-${theme}.png`, fullPage: true, animations: "disabled" });
      await page.goto(`${base}/showcase/cards/slab`, { waitUntil: "networkidle" });
      await page.getByRole("button", { name: "查看大图", exact: true }).click();
      const themedZoomInput = page.getByRole("dialog").getByRole("spinbutton", { name: "缩放比例" });
      await themedZoomInput.focus();
      assert.deepEqual(await themedZoomInput.evaluate(input => ({ input: getComputedStyle(input).boxShadow, outer: getComputedStyle(input.parentElement).outlineStyle })), { input: "none", outer: "none" }, `${theme} zoom input avoids stacked focus frames`);
      await page.keyboard.press("Escape");
    }
    await page.context().addCookies([{ name: "card_vault_ui_locale", value: "en", url: base }]);
    await page.goto(`${base}/showcase/cards/slab`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "View full image", exact: true }).click();
    const hanUi = await page.locator("body").evaluate(body => [...body.querySelectorAll("button,dt,h2,[aria-label]")].filter(element => /[\u3400-\u9fff]/u.test(element.textContent + (element.getAttribute("aria-label") || ""))).map(element => element.textContent));
    assert.deepEqual(hanUi, []);
    await page.keyboard.press("Escape");
    for (const width of [736, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`${base}/showcase`, { waitUntil: "networkidle" });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `wall fits ${width}`);
      await page.goto(`${base}/showcase/cards/slab`, { waitUntil: "networkidle" });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `detail fits ${width}`);
    }
    await page.goto(`${base}/showcase?q=no-such-card`, { waitUntil: "networkidle" });
    await page.getByRole("heading", { name: "No matching cards" }).waitFor();
    const insertChineseCard = db.prepare("INSERT INTO Card(id,playerName,cardTitle,sport) VALUES(?,?,?,'Basketball')");
    insertChineseCard.run("han-zhang", "张三", "Chinese subject A");
    insertChineseCard.run("han-li", "李四", "Chinese subject B");
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(`${base}/showcase`, { waitUntil: "networkidle" });
    const subjectNames = await page.locator(".showcase-group-row a[title]").evaluateAll(links => links.map(link => link.getAttribute("title")));
    assert.deepEqual(subjectNames.slice(-2), ["李四", "张三"], "Chinese subject names follow English names and use Chinese ordering");
    const cardSubjects = await page.locator(".showcase-card-body h3").allInnerTexts();
    assert.ok(cardSubjects.slice(0, -2).every(name => !/[\u3400-\u9fff]/u.test(name)) && cardSubjects.slice(-2).every(name => /[\u3400-\u9fff]/u.test(name)), "wall places Chinese subjects after English subjects");
    db.exec("DELETE FROM Card WHERE id IN ('han-zhang', 'han-li')");
    await page.setViewportSize({ width: 320, height: 900 });
    const insertOrderedCard = db.prepare("INSERT INTO Card(id,playerName,cardTitle,sport,createdAt) VALUES(?, 'Jordan Lee', ?, 'Basketball', ?)");
    insertOrderedCard.run("slab-newer", "Later release", "2027-01-01 00:00:00");
    insertOrderedCard.run("slab-older", "Earlier release", "2025-01-01 00:00:00");
    await page.goto(`${base}/showcase/cards/slab?group=Jordan+Lee`, { waitUntil: "networkidle" });
    assert.equal(await page.locator(".showcase-position").innerText(), "2 / 3");
    assert.match(await page.getByRole("link", { name: /Previous Card/i }).getAttribute("href"), /slab-newer/);
    assert.match(await page.getByRole("link", { name: /Next Card/i }).getAttribute("href"), /slab-older/);
    db.exec("DELETE FROM Card");
    await page.goto(`${base}/showcase`, { waitUntil: "networkidle" });
    await page.getByRole("heading", { name: "Your collection starts here" }).waitFor();
    const insertPagedCard = db.prepare("INSERT INTO Card(id,playerName,cardTitle,sport,createdAt) VALUES(?,?,?,'Basketball',?)");
    db.exec("BEGIN");
    for (let index = 0; index < 101; index++) {
      const id = `paging-${String(index).padStart(3, "0")}`;
      insertPagedCard.run(id, "Paging Subject", `Paging Card ${index}`, Date.parse("2026-01-01T00:00:00.000Z"));
    }
    db.exec("COMMIT");
    await page.goto(`${base}/showcase?q=Paging`, { waitUntil: "networkidle" });
    assert.equal(await page.locator(".showcase-card").count(), 48);
    assert.match(await page.locator(".showcase-summary").innerText(), /101/);
    assert.equal(await page.locator(".showcase-page-position").innerText(), "1 / 3");
    assert.match(await page.locator(".showcase-pagination-next").getAttribute("href"), /page=2/);
    await page.locator(".showcase-pagination-next").click();
    await page.waitForURL(/page=2/);
    assert.match(page.url(), /page=2/);
    assert.equal(await page.locator(".showcase-card").count(), 48);
    assert.match(await page.locator(".showcase-card").first().getAttribute("href"), /paging-048/);
    await page.locator(".showcase-card").first().click();
    await page.waitForURL(/\/showcase\/cards\/paging-048/);
    assert.equal(await page.locator(".showcase-position").innerText(), "49 / 101");
    assert.match(await page.getByRole("link", { name: /Back to collection/ }).getAttribute("href"), /page=2/);
    await page.getByRole("link", { name: /Previous Card/i }).click();
    await page.waitForURL(/\/showcase\/cards\/paging-047/);
    assert.equal(await page.locator(".showcase-position").innerText(), "48 / 101");
    assert.ok(!(await page.getByRole("link", { name: /Back to collection/ }).getAttribute("href")).includes("page="));
    await page.getByRole("link", { name: /Next Card/i }).click();
    await page.waitForURL(/\/showcase\/cards\/paging-048/);
    assert.equal(await page.locator(".showcase-position").innerText(), "49 / 101");
    await page.goto(`${base}/showcase?q=Paging&page=99999`, { waitUntil: "networkidle" });
    assert.equal(await page.locator(".showcase-card").count(), 5);
    assert.equal(await page.locator(".showcase-page-position").innerText(), "3 / 3");
    assert.equal(await page.locator(".showcase-pagination-next").count(), 0);
    await page.locator(".showcase-card").last().click();
    await page.waitForURL(/\/showcase\/cards\/paging-100/);
    assert.equal(await page.locator(".showcase-position").innerText(), "101 / 101");
    assert.match(await page.getByRole("link", { name: /Back to collection/ }).getAttribute("href"), /page=3/);
    await page.goto(`${base}/showcase?q=Paging&page=2`, { waitUntil: "networkidle" });
    await page.locator(".showcase-group-select").selectOption("Paging Subject");
    await page.waitForURL(/group=Paging/);
    assert.ok(!page.url().includes("page="), "changing groups returns to the first page");
    await page.goto(`${base}/showcase?q=Paging&page=invalid`, { waitUntil: "networkidle" });
    assert.equal(await page.locator(".showcase-page-position").innerText(), "1 / 3");
    await page.goto(`${base}/showcase?q=%25`, { waitUntil: "networkidle" });
    if (await page.locator(".showcase-card").count()) {
      await page.locator(".showcase-card").first().click();
      await page.waitForURL(/\/showcase\/cards\//);
      assert.equal(await page.locator(".showcase-position").innerText(), "1 / 101", "neighbor scope must match search semantics");
    }
    assert.deepEqual(browserErrors, []);
    console.log("Showcase passed: complete image bounds, missing/broken images, 1100/1440/1920 layouts, saved list view, scoped return, rotation, five images, zoom/scroll/keys/focus, four themes, English, narrow windows, empty states and cross-page navigation.");
  } catch (error) {
    const page = browser?.contexts()[0]?.pages()[0];
    if (page) {
      await page.screenshot({ path: "logs/v1.4.2-showcase-failure.png", fullPage: true }).catch(() => {});
      console.error(await page.locator(".showcase-media").evaluateAll(nodes => nodes.map(node => ({ text: node.textContent, image: node.querySelector("img")?.outerHTML }))));
    }
    console.error(output.join("")); throw error;
  }
  finally { await browser?.close(); db?.close(); stopServer(server); await removeTempRoot(root); }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
