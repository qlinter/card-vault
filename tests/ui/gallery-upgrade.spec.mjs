import { expect, test } from "@playwright/test";

const portrait = `<svg xmlns="http://www.w3.org/2000/svg" width="700" height="1080" viewBox="0 0 700 1080">
<defs><linearGradient id="slab" x2="1" y2="1"><stop stop-color="#d3d5d3"/><stop offset=".5" stop-color="#9fa4a3"/><stop offset="1" stop-color="#e1e1db"/></linearGradient><linearGradient id="card" x2=".7" y2="1"><stop stop-color="#253b4a"/><stop offset="1" stop-color="#091820"/></linearGradient></defs>
<rect x="6" y="6" width="688" height="1068" rx="32" fill="url(#slab)"/><rect x="23" y="22" width="654" height="1036" rx="22" fill="#1b252c"/>
<rect x="48" y="43" width="604" height="130" rx="5" fill="#e9e5d9"/><path d="M55 143h591" stroke="#b7ad96"/><text x="72" y="79" font-family="Arial" font-size="17" letter-spacing="4" fill="#52606a">VAULT ARCHIVE / 2024</text><text x="72" y="120" font-family="Georgia" font-size="29" fill="#202d35">HERITAGE COLLECTION</text><text x="585" y="122" font-family="Georgia" font-size="43" fill="#26333a">10</text><text x="72" y="162" font-family="Arial" font-size="10" letter-spacing="2" fill="#69716f">SYNTHETIC VISUAL TEST / 008</text>
<rect x="48" y="196" width="604" height="836" rx="4" fill="url(#card)"/><rect x="65" y="213" width="570" height="802" fill="none" stroke="#9d8d6a" stroke-width="2"/>
<path d="M67 690 635 288M67 780 635 378M67 870 635 468" stroke="#9d8d6a" opacity=".12" stroke-width="42"/><circle cx="359" cy="525" r="168" fill="none" stroke="#6b7b7d" opacity=".3"/><circle cx="359" cy="525" r="183" fill="none" stroke="#6b7b7d" opacity=".12"/>
<circle cx="351" cy="399" r="37" fill="#c9ba98"/><path d="m317 450 81 1 33 161-52 10-6 152-51 20-17-175-65-55 13-100 39-17 28-90 25 13-10 111-30 23 12 74 45 24Z" fill="#c9ba98"/><path d="m390 461 77-92 35 18-81 129Z" fill="#c9ba98"/><circle cx="501" cy="345" r="33" fill="#b99b65"/><path d="m486 315 29 59m-45-29h63" stroke="#624b34" stroke-width="2"/>
<text x="92" y="269" font-family="Arial" font-size="14" letter-spacing="6" fill="#c8bb9a">ECHOES OF THE GAME</text><text x="92" y="859" font-family="Georgia" font-size="76" fill="#e5dfce">Carter</text><text x="94" y="894" font-family="Arial" font-size="14" letter-spacing="5" fill="#aab7b9">THE SIGNATURE EDITION</text><path d="M94 923h508" stroke="#8f805e"/><text x="94" y="965" font-family="Georgia" font-style="italic" font-size="23" fill="#c8bb9a">A moment, preserved.</text><text x="539" y="966" font-family="Arial" font-size="14" fill="#c8bb9a">07/25</text></svg>`;
const landscape = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="700"><rect width="1200" height="700" rx="16" fill="#20313e"/><rect x="18" y="18" width="1164" height="664" fill="none" stroke="#b8a581" stroke-width="3"/><circle cx="600" cy="338" r="210" fill="#2d4450"/><path d="M75 585 1125 95" stroke="#b8a581" stroke-width="55" opacity=".1"/><text x="70" y="100" font-size="24" letter-spacing="8" fill="#baaa87" font-family="Arial">VAULT / HORIZONS</text><text x="70" y="570" font-size="100" fill="#e1ded3" font-family="Georgia">The Long View</text><text x="74" y="625" font-size="24" letter-spacing="6" fill="#b3bdbe" font-family="Arial">SYNTHETIC LANDSCAPE FIXTURE</text></svg>`;

async function exhibition(page, { horizontal = false, rotation = 0, long = false, multiple = false, settle = true } = {}) {
  const cards = [{ id: "gallery-one", playerName: long ? "The extraordinarily long name of a private collection's featured athlete" : "Carter", cardTitle: long ? "2024 Heritage Signature Collection · An extraordinarily long exhibition title with multiple editions and detailed catalogue information" : "2024 Heritage · The Signature Edition", year: "2024", brand: "Vault Archive", productLine: "Heritage", parallel: "Gold", grade: "10", gradingCompany: "VAULT", serialNumber: "07", serialRange: "/25", collectionStatus: "holding", images: [{ id: "gallery-front", path: "/media/gallery-study.webp", rotation }] }];
  if (multiple) {
    cards[0].images.push({ id: "gallery-back", path: "/media/gallery-back.webp", rotation: 0 });
    cards.push({ ...cards[0], id: "gallery-two", playerName: "Second Card", images: [{ id: "gallery-two-front", path: "/media/gallery-two.webp", rotation: 0 }] });
  }
  await page.route("**/api/immersive?*", async route => {
    const url = new URL(route.request().url());
    await route.fulfill({ json: url.searchParams.has("id") ? { card: cards.find(card => card.id === url.searchParams.get("id")) } : { ids: cards.map(card => card.id), nextCursor: null, revision: "1" } });
  });
  await page.route("**/media/gallery-study.webp", route => route.fulfill({ contentType: "image/svg+xml", body: horizontal ? landscape : portrait }));
  await page.route("**/media/gallery-{back,two}.webp", route => route.fulfill({ contentType: "image/svg+xml", body: landscape }));
  await page.goto("/showcase", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /^(浏览|Browse)$/ }).click();
  const viewer = page.getByRole("dialog", { name: /^(沉浸式赏卡|Immersive Viewing)$/ });
  await expect(viewer).toHaveAttribute("data-ready", "true");
  if (settle) await viewer.locator(".gallery-image-reveal").evaluate(element => Promise.all(element.getAnimations().map(animation => animation.finished.catch(() => {}))));
  return viewer;
}

test("Browse and Shares share typography and geometry while search has no placeholder", async ({ page }) => {
  await page.goto("/showcase");
  const header = page.locator(".showcase-heading");
  await expect(header.getByRole("button", { name: "开始赏卡", exact: true })).toHaveCount(0);
  expect(await header.locator('input[name="q"]').getAttribute("placeholder")).toBeNull();
  await expect(header.locator('input[name="q"]')).toHaveAccessibleName(/搜索卡片主体/);
  const compare = element => { const s = getComputedStyle(element); return [s.height, s.fontSize, s.fontWeight, s.lineHeight, s.padding, s.borderRadius, s.borderColor, s.backgroundColor, s.color]; };
  const browse = await header.getByRole("button", { name: "浏览", exact: true }).evaluate(compare);
  const shares = await header.getByRole("link", { name: "分享集", exact: true }).evaluate(compare);
  expect(browse).toEqual(shares);
  expect((await header.getByRole("button", { name: "浏览", exact: true }).boundingBox()).height).toBe(36);
  expect((await header.locator(".showcase-search").boundingBox()).width).toBeLessThanOrEqual(281);
});

for (const shape of ["portrait", "landscape", "rotated", "long"]) test(`gallery preserves image bounds and label alignment (${shape})`, async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 760 });
  const viewer = await exhibition(page, { horizontal: shape === "landscape", rotation: shape === "rotated" ? 90 : 0, long: shape === "long" });
  const art = await viewer.locator(".showcase-media-image").boundingBox(), stage = await viewer.locator(".immersive-stage").boundingBox();
  expect(art.x).toBeGreaterThanOrEqual(stage.x - 1); expect(art.y).toBeGreaterThanOrEqual(stage.y - 1);
  expect(art.x + art.width).toBeLessThanOrEqual(stage.x + stage.width + 1); expect(art.y + art.height).toBeLessThanOrEqual(stage.y + stage.height + 1);
  const columns = await viewer.locator(".gallery-work-facts dd").evaluateAll(elements => elements.map(element => element.getBoundingClientRect().left));
  expect(new Set(columns).size).toBe(1);
  expect(await viewer.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  const caption = await viewer.locator(".immersive-caption").boundingBox(); expect(caption.y).toBeGreaterThan(70); expect(caption.y + caption.height).toBeLessThan(690);
});

test("idle controls do not resize the exhibition or shift the artwork", async ({ page }) => {
  const viewer = await exhibition(page);
  await viewer.focus(); await page.mouse.move(15, 250);
  const before = await viewer.locator(".showcase-media-image").boundingBox();
  await expect(viewer).toHaveClass(/is-idle/, { timeout: 6000 });
  const after = await viewer.locator(".showcase-media-image").boundingBox(); expect(after).toEqual(before);
});

test("zoom remains scrollable inside the artwork area without covering the exhibit label", async ({ page }) => {
  const viewer = await exhibition(page);
  await viewer.getByRole("button", { name: "放大", exact: true }).click();
  await viewer.getByRole("button", { name: "放大", exact: true }).click();
  const viewport = viewer.locator(".gallery-art-viewport");
  await expect.poll(() => viewport.evaluate(element => element.scrollHeight > element.clientHeight && element.scrollWidth > element.clientWidth)).toBe(true);
  const scroll = await viewport.evaluate(element => { element.scrollTo(70, 100); return { left: element.scrollLeft, top: element.scrollTop }; });
  expect(scroll.left).toBeGreaterThan(0); expect(scroll.top).toBeGreaterThan(0);
  await viewer.getByRole("button", { name: "重置缩放", exact: true }).click();
  await expect(viewer.getByRole("button", { name: "重置缩放", exact: true })).toHaveText("100%");
  await expect.poll(() => viewport.evaluate(element => element.scrollTop)).toBe(0);
});

for (const locale of ["zh-CN", "en"]) test(`gallery settings persist and Escape closes settings first (${locale})`, async ({ page, context }) => {
  await context.addCookies([{ name: "card_vault_ui_locale", value: locale, url: "http://127.0.0.1:3360" }]);
  const l = (zh, en) => locale === "en" ? en : zh;
  const viewer = await exhibition(page);
  await viewer.getByRole("button", { name: l("展馆设置", "Gallery Settings"), exact: true }).click();
  await viewer.getByRole("combobox", { name: l("画面构图", "Composition"), exact: true }).selectOption("focus");
  await viewer.getByRole("slider", { name: l("画幅大小", "Artwork Size"), exact: true }).press("Home");
  await viewer.getByRole("slider", { name: l("画幅大小", "Artwork Size"), exact: true }).press("ArrowRight");
  await expect(viewer.getByRole("slider", { name: l("画幅大小", "Artwork Size"), exact: true })).toHaveValue("61");
  await viewer.getByRole("button", { name: l("保存", "Save"), exact: true }).click();
  await page.keyboard.press("Escape"); await expect(viewer.locator(".immersive-settings")).toBeHidden();
  await expect(viewer.getByRole("button", { name: l("展馆设置", "Gallery Settings"), exact: true })).toBeFocused();
  await expect(viewer).toBeVisible();
  if (locale === "en") expect(await viewer.innerText()).not.toMatch(/[\u3400-\u9fff]/);
  await page.keyboard.press("Escape"); await expect(viewer).toHaveCount(0);
  await page.getByRole("button", { name: /^(浏览|Browse)$/ }).click();
  await expect(viewer).toHaveAttribute("data-gallery-layout", "focus");
  expect(await viewer.evaluate(element => element.style.getPropertyValue("--gallery-art-scale"))).toBe("0.61");
});

test("spotlight gallery portrait visual baseline", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" }); const viewer = await exhibition(page); await viewer.focus();
  await expect(page).toHaveScreenshot("gallery-spotlight.png");
});
test("spotlight gallery settings visual baseline", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" }); const viewer = await exhibition(page);
  await viewer.getByRole("button", { name: "展馆设置", exact: true }).click();
  await expect(page).toHaveScreenshot("gallery-settings.png");
});

const scenes = [["spotlight", "暗室聚光"], ["whitebox", "白盒美术馆"], ["archive", "暖纸典藏"], ["moonlight", "月光展厅"]];
function luminance(color) {
  const channels = color.trim().startsWith("#") ? color.trim().slice(1).match(/../g).map(value => Number.parseInt(value, 16)) : color.match(/[\d.]+/g).slice(0, 3).map(Number);
  const [r, g, b] = channels.map(value => { const c = value / 255; return c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4; });
  return r * .2126 + g * .7152 + b * .0722;
}
for (const [scene, label] of scenes) test(`gallery scene switches, stays legible and persists (${scene})`, async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const viewer = await exhibition(page);
  const image = viewer.locator(".showcase-media-image"), bounds = await image.boundingBox();
  await viewer.getByRole("button", { name: "展馆设置", exact: true }).click();
  await expect(viewer.getByRole("combobox", { name: "展示风格", exact: true }).locator("option")).toHaveCount(4);
  await viewer.getByRole("combobox", { name: "展示风格", exact: true }).selectOption({ label });
  await expect(viewer).toHaveAttribute("data-gallery-scene", scene);
  await expect(viewer.getByRole("combobox", { name: "展示风格", exact: true })).toHaveValue(scene);
  await viewer.getByRole("button", { name: "保存", exact: true }).click();
  await page.keyboard.press("Escape");
  expect(await image.boundingBox()).toEqual(bounds);
  const palette = await viewer.evaluate(element => { const s = getComputedStyle(element); return { text: s.getPropertyValue("--gallery-muted"), walls: ["--gallery-wall-lit", "--gallery-wall-mid", "--gallery-wall-edge"].map(key => s.getPropertyValue(key)), scheme: s.colorScheme }; });
  for (const wall of palette.walls) {
    const a = luminance(palette.text), b = luminance(wall);
    expect((Math.max(a, b) + .05) / (Math.min(a, b) + .05)).toBeGreaterThanOrEqual(4.5);
  }
  expect(palette.scheme).toBe(scene === "archive" || scene === "whitebox" ? "light" : "dark");
  await expect(viewer.locator(".gallery-exhibit-number,.gallery-caption-foot,.gallery-playback-state,.gallery-work-year")).toHaveCount(0);
  await expect(viewer.locator(".gallery-position")).toHaveCount(1);
  const bodySizes = await viewer.locator(".gallery-work-title,.gallery-work-facts dd").evaluateAll(elements => elements.map(element => getComputedStyle(element).fontSize));
  expect(new Set(bodySizes).size).toBe(1);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "浏览", exact: true }).click();
  await expect(viewer).toHaveAttribute("data-gallery-scene", scene);
  await expect(viewer).toHaveAttribute("data-ready", "true");
  if (scene !== "spotlight") await expect(page).toHaveScreenshot(`gallery-${scene}.png`);
});

test("compact showcase actions and search align across desktop sizes and app themes", async ({ page, context }) => {
  for (const theme of ["classic", "gallery", "midnight", "archive"]) for (const width of [1100, 1440]) {
    await context.addCookies([{ name: "card_vault_app_theme", value: theme, url: "http://127.0.0.1:3360" }]);
    await page.setViewportSize({ width, height: 760 }); await page.goto("/showcase");
    const actions = await page.locator(".showcase-action").evaluateAll(elements => elements.map(element => { const s = getComputedStyle(element), r = element.getBoundingClientRect(); return { y: r.y, height: r.height, font: s.font, background: s.backgroundColor, border: s.borderColor }; }));
    expect(actions[0]).toEqual(actions[1]); expect(actions[0].height).toBe(36);
    expect((await page.locator(".showcase-search").boundingBox()).width).toBeLessThanOrEqual(281);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});

test("fullscreen displays only the gallery surface and restores the originating page", async ({ page }) => {
  const viewer = await exhibition(page), url = page.url();
  await viewer.getByRole("button", { name: "全屏", exact: true }).click();
  await expect.poll(() => page.evaluate(() => document.fullscreenElement?.className)).toBe("immersive-surface");
  await expect.poll(() => page.evaluate(() => {
    const surface = document.fullscreenElement, rect = surface.getBoundingClientRect();
    const covered = [.05, .5, .95].every(x => [.05, .5, .95].every(y => surface.contains(document.elementFromPoint(innerWidth * x, innerHeight * y))));
    return covered && rect.x === 0 && rect.y === 0 && rect.width === innerWidth && rect.height === innerHeight;
  })).toBe(true);
  await viewer.getByRole("button", { name: "展馆设置", exact: true }).click();
  await viewer.getByRole("combobox", { name: "展示风格", exact: true }).selectOption("whitebox");
  await page.keyboard.press("Escape"); await expect(viewer.locator(".immersive-settings")).toBeHidden();
  await expect.poll(() => page.evaluate(() => Boolean(document.fullscreenElement))).toBe(true);
  await page.keyboard.press("Escape"); await expect.poll(() => page.evaluate(() => document.fullscreenElement)).toBeNull();
  await expect(viewer).toBeVisible(); await expect(viewer).toHaveAttribute("data-gallery-scene", "whitebox");
  await page.keyboard.press("Escape"); await expect(viewer).toHaveCount(0);
  expect(page.url()).toBe(url); await expect(page.getByRole("button", { name: "浏览", exact: true })).toBeFocused();
});

for (const mode of ["first", "all"]) test(`custom playback interval follows the selected image mode (${mode})`, async ({ page }) => {
  const viewer = await exhibition(page, { multiple: true }), stage = viewer.locator(".immersive-stage"), image = viewer.locator(".showcase-media-image");
  await viewer.getByRole("button", { name: "展馆设置", exact: true }).click();
  await viewer.getByRole("combobox", { name: "播放模式", exact: true }).selectOption(mode);
  await viewer.getByRole("spinbutton", { name: "间隔（秒）", exact: true }).fill("3");
  await viewer.getByRole("button", { name: "关闭设置", exact: true }).click();
  await page.clock.install();
  await viewer.getByRole("button", { name: "播放", exact: true }).click();
  await page.clock.runFor(2999); await expect(stage).toHaveAttribute("data-card-id", "gallery-one");
  await expect(image).toHaveAttribute("src", "/media/gallery-study.webp");
  await page.clock.runFor(1);
  if (mode === "all") {
    await expect(image).toHaveAttribute("src", "/media/gallery-back.webp");
    await expect(stage).toHaveAttribute("data-card-id", "gallery-one");
    await expect(viewer).toHaveAttribute("data-ready", "true");
    await page.clock.runFor(3000);
  }
  await expect(stage).toHaveAttribute("data-card-id", "gallery-two");
  await expect(image).toHaveAttribute("src", "/media/gallery-two.webp");
  await expect(viewer).toHaveAttribute("data-ready", "true");
  await page.clock.runFor(3000); await expect(stage).toHaveAttribute("data-card-id", "gallery-one");
  await expect(image).toHaveAttribute("src", "/media/gallery-study.webp");
});

test("custom interval stays valid after empty, fractional and out-of-range input", async ({ page }) => {
  const viewer = await exhibition(page);
  await viewer.getByRole("button", { name: "展馆设置", exact: true }).click();
  const interval = viewer.getByRole("spinbutton", { name: "间隔（秒）", exact: true });
  for (const [input, expected] of [["", "8"], ["0", "1"], ["5000", "3600"], ["2.6", "3"]]) {
    await interval.fill(input); await interval.press("Tab"); await expect(interval).toHaveValue(expected);
  }
  await interval.fill("17"); await interval.press("Enter"); await expect(interval).toHaveValue("17");
  await viewer.getByRole("button", { name: "关闭设置", exact: true }).click();
  await viewer.getByRole("button", { name: "展馆设置", exact: true }).click(); await expect(interval).toHaveValue("17");
});

test("soft transitions are always enabled and respect the system reduced-motion setting", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  const viewer = await exhibition(page);
  const durations = () => viewer.locator(".immersive-art,.immersive-caption,.immersive-top,.immersive-controls").evaluateAll(elements => elements.map(element => getComputedStyle(element).transitionDuration));
  expect((await durations()).every(value => parseFloat(value) > 0)).toBe(true);
  await viewer.getByRole("button", { name: "展馆设置", exact: true }).click();
  await expect(viewer.getByRole("checkbox", { name: /^柔和切换/ })).toHaveCount(0);
  await page.emulateMedia({ reducedMotion: "reduce" }); expect(await durations()).toEqual(["0s", "0s", "0s", "0s"]);
});

for (const locale of ["zh-CN", "en"]) test(`Save remembers gallery appearance and playback, while unsaved previews stay temporary (${locale})`, async ({ page, context }) => {
  await context.addCookies([{ name: "card_vault_ui_locale", value: locale, url: "http://127.0.0.1:3360" }]);
  const l = (zh, en) => locale === "en" ? en : zh;
  const viewer = await exhibition(page);
  const openSettings = () => viewer.getByRole("button", { name: l("展馆设置", "Gallery Settings"), exact: true }).click();
  await openSettings();
  await expect(viewer.locator(".gallery-keyboard-help")).toHaveCount(0);
  await viewer.getByRole("combobox", { name: l("展示风格", "Gallery Style"), exact: true }).selectOption("archive");
  await viewer.getByRole("combobox", { name: l("播放顺序", "Playback Order"), exact: true }).selectOption("random");
  await viewer.getByRole("combobox", { name: l("播放模式", "Playback Mode"), exact: true }).selectOption("all");
  await viewer.getByRole("spinbutton", { name: l("间隔（秒）", "Interval (seconds)"), exact: true }).fill("17");
  const card = await viewer.locator(".immersive-stage").getAttribute("data-card-id");
  await viewer.getByRole("button", { name: l("保存", "Save"), exact: true }).click();
  await expect(viewer.locator(".gallery-settings-footer").getByRole("status")).toHaveText(l("展馆设置已保存。", "Gallery settings saved."));
  await expect(viewer.locator(".immersive-stage")).toHaveAttribute("data-card-id", card);
  await viewer.getByRole("combobox", { name: l("展示风格", "Gallery Style"), exact: true }).selectOption("whitebox");
  await expect(viewer.locator(".gallery-settings-footer").getByRole("status")).toHaveCount(0);
  await viewer.getByRole("spinbutton", { name: l("间隔（秒）", "Interval (seconds)"), exact: true }).fill("23");
  await page.keyboard.press("Escape"); await page.keyboard.press("Escape");
  await page.reload(); await page.getByRole("button", { name: /^(浏览|Browse)$/ }).click(); await openSettings();
  await expect(viewer.getByRole("combobox", { name: l("展示风格", "Gallery Style"), exact: true })).toHaveValue("archive");
  await expect(viewer.getByRole("combobox", { name: l("播放顺序", "Playback Order"), exact: true })).toHaveValue("random");
  await expect(viewer.getByRole("combobox", { name: l("播放模式", "Playback Mode"), exact: true })).toHaveValue("all");
  await expect(viewer.getByRole("spinbutton", { name: l("间隔（秒）", "Interval (seconds)"), exact: true })).toHaveValue("17");
});

test("failed local saving reports the error without losing the preview", async ({ page }) => {
  const viewer = await exhibition(page);
  await page.evaluate(() => { Storage.prototype.setItem = () => { throw new DOMException("Storage unavailable", "QuotaExceededError"); }; });
  await viewer.getByRole("button", { name: "展馆设置", exact: true }).click();
  await viewer.getByRole("combobox", { name: "展示风格", exact: true }).selectOption("moonlight");
  await viewer.getByRole("button", { name: "保存", exact: true }).click();
  await expect(viewer.locator(".gallery-settings-footer").getByRole("status")).toContainText("无法保存到本机"); await expect(viewer).toHaveAttribute("data-gallery-scene", "moonlight");
  await page.keyboard.press("Escape"); await expect(viewer.getByRole("button", { name: "播放", exact: true })).toBeEnabled();
});

test("cached image changes replay the reveal and system reduced motion stays immediate", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.addInitScript(() => localStorage.setItem("card-vault-gallery-presentation-v1", JSON.stringify({ motion: false })));
  const viewer = await exhibition(page, { multiple: true });
  await page.keyboard.press("ArrowDown"); await expect(viewer).toHaveAttribute("data-ready", "true");
  const reveal = viewer.locator(".gallery-image-reveal");
  await expect.poll(() => reveal.evaluate(element => element.getAnimations().length)).toBe(1);
  const sample = await reveal.evaluate(element => {
    const animation = element.getAnimations()[0]; animation.pause(); animation.currentTime = 300;
    return { duration: animation.effect.getTiming().duration, opacity: Number(getComputedStyle(element).opacity), transform: getComputedStyle(element).transform };
  });
  expect(sample.duration).toBe(820); expect(sample.opacity).toBeGreaterThan(0); expect(sample.opacity).toBeLessThan(.95); expect(sample.transform).not.toBe("none");
  await reveal.evaluate(element => element.getAnimations()[0].finish());
  await page.keyboard.press("ArrowUp"); await expect(viewer.locator(".showcase-media-image")).toHaveAttribute("src", "/media/gallery-study.webp");
  await expect(viewer).toHaveAttribute("data-ready", "true");
  await expect.poll(() => reveal.evaluate(element => element.getAnimations().length)).toBe(1);
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(await reveal.evaluate(element => element.getAnimations().length)).toBe(0);
  await page.keyboard.press("ArrowDown"); await expect(viewer).toHaveAttribute("data-ready", "true");
  expect(await reveal.evaluate(element => ({ opacity: getComputedStyle(element).opacity, transform: getComputedStyle(element).transform, animations: element.getAnimations().length }))).toEqual({ opacity: "1", transform: "none", animations: 0 });
});

for (const locale of ["zh-CN", "en"]) test(`gallery keyboard instructions are accessible through Settings Help (${locale})`, async ({ page, context }) => {
  await context.addCookies([{ name: "card_vault_ui_locale", value: locale, url: "http://127.0.0.1:3360" }]);
  const l = (zh, en) => locale === "en" ? en : zh;
  await page.goto("/settings"); await page.getByRole("button", { name: new RegExp(l("帮助与版本", "Help & version")) }).click();
  await page.getByRole("link", { name: l("使用说明", "User guide"), exact: true }).click();
  await expect(page).toHaveURL(/\/settings\/guide$/);
  await expect(page.getByRole("heading", { name: l("浏览键盘操作", "Gallery keyboard shortcuts"), exact: true })).toBeVisible();
  await expect(page.locator(".user-guide-shortcuts dt")).toHaveCount(5);
});

for (const [scene, label] of scenes) test(`gallery settings and expanded style picker match the exhibition (${scene})`, async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const viewer = await exhibition(page);
  if (scene === "spotlight") await viewer.getByRole("button", { name: "全屏", exact: true }).click();
  await viewer.getByRole("button", { name: "展馆设置", exact: true }).click();
  const select = viewer.getByRole("combobox", { name: "展示风格", exact: true });
  await select.selectOption(scene);
  await expect(viewer.getByText("柔和切换", { exact: true })).toHaveCount(0);
  const fields = await viewer.locator(".immersive-settings select,.immersive-settings input[type=number]").evaluateAll(elements => elements.map(element => {
    const style = getComputedStyle(element), rect = element.getBoundingClientRect();
    return { top: style.borderTopWidth, bottom: style.borderBottomWidth, radius: style.borderRadius, background: style.backgroundColor, font: style.fontSize, height: rect.height };
  }));
  for (const field of fields) expect(field).toEqual({ top: "0px", bottom: "1px", radius: "0px", background: "rgba(0, 0, 0, 0)", font: "14px", height: 40 });
  if (scene !== "spotlight") await expect(page).toHaveScreenshot(`gallery-settings-${scene}.png`);
  if (await page.evaluate(() => CSS.supports("appearance", "base-select"))) {
    expect(await select.evaluate(element => getComputedStyle(element).appearance)).toBe("base-select");
    await select.click(); await expect.poll(() => select.evaluate(element => element.matches(":open"))).toBe(true);
    await expect(page).toHaveScreenshot(`gallery-picker-${scene}.png`);
    await viewer.getByRole("option", { name: label, exact: true }).click();
    await expect(select).toHaveValue(scene);
    await select.focus(); await page.keyboard.press("Space"); await expect.poll(() => select.evaluate(element => element.matches(":open"))).toBe(true);
    await page.keyboard.press("Escape"); await expect.poll(() => select.evaluate(element => element.matches(":open"))).toBe(false);
    await expect(viewer.locator(".immersive-settings")).toBeVisible();
    await page.keyboard.press("Space"); await expect.poll(() => select.evaluate(element => element.matches(":open"))).toBe(true);
    await page.keyboard.press("ArrowDown"); await page.keyboard.press("Enter"); await expect.poll(() => select.evaluate(element => element.matches(":open"))).toBe(false);
  }
  await viewer.getByRole("button", { name: "保存", exact: true }).click();
  await expect(viewer.locator(".gallery-settings-footer").getByRole("status")).toHaveText("展馆设置已保存。");
});

test("gallery fields and Save remain contained at narrow and minimum window sizes", async ({ page }) => {
  const viewer = await exhibition(page);
  await viewer.getByRole("button", { name: "展馆设置", exact: true }).click();
  for (const size of [{ width: 320, height: 640 }, { width: 1100, height: 760 }]) {
    await page.setViewportSize(size);
    const panel = await viewer.locator(".immersive-settings").boundingBox();
    const save = await viewer.getByRole("button", { name: "保存", exact: true }).boundingBox();
    expect(save.y + save.height).toBeLessThanOrEqual(size.height); expect(save.x).toBeGreaterThanOrEqual(panel.x);
    expect(save.x + save.width).toBeLessThanOrEqual(panel.x + panel.width);
    expect(await viewer.locator(".immersive-settings-body").evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  }
});
