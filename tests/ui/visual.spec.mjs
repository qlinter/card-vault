import { expect, test } from "@playwright/test";

const screenshotMode = process.env.CARD_VAULT_UI_SCREENSHOT_MODE || "compare";
if (!new Set(["compare", "capture"]).has(screenshotMode)) {
  throw new Error(`Unknown CARD_VAULT_UI_SCREENSHOT_MODE: ${screenshotMode}`);
}

const pages = [
  { name: "home", path: "/", ready: ".summary-grid" },
  { name: "home-list", path: "/", ready: ".cards-grid.is-list", view: "list" },
  { name: "showcase", path: "/showcase", ready: ".showcase-grid" },
  { name: "showcase-list", path: "/showcase", ready: ".showcase-views.is-list", view: "list" },
  { name: "card-entry", path: "/cards/new", ready: ".entry-workbench-layout" },
  { name: "portfolio", path: "/portfolio", ready: ".portfolio-page" },
  { name: "shares", path: "/shares", ready: ".share-list" },
  { name: "share-editor", path: "/shares/ui-share-1/edit", ready: ".shares-page" },
  { name: "share-preview", path: "/shares/ui-share-1/preview", ready: ".share-unified-preview-page" },
  { name: "settings", path: "/settings", ready: ".settings-page" },
  { name: "settings-data", path: "/settings#data-settings", ready: ".management-card-list" },
  { name: "data-center", path: "/settings/data", ready: ".management-card-list" },
  { name: "collection", path: "/collection", ready: ".management-page .summary-grid" },
  { name: "user-guide", path: "/settings/guide", ready: ".user-guide-index" },
  { name: "finance-rules", path: "/settings/finance-rules", ready: ".finance-rules-page" }
];

const englishAuditPages = [
  ...pages,

  { name: "showcase-card", path: "/showcase/cards/ui-card-1", ready: ".showcase-detail" },
  { name: "card-details", path: "/cards/ui-card-1", ready: ".details" },
  { name: "card-edit", path: "/cards/ui-card-1/edit", ready: "form.panel" },
  { name: "card-delete", path: "/cards/ui-card-1/delete", ready: ".panel" },
  { name: "share-new", path: "/shares/new", ready: ".shares-page" },
  { name: "share-export", path: "/shares/ui-share-1/export", ready: ".shares-page" }
];

const hanPattern = /[\u3400-\u9fff]/u;

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
});

for (const target of pages) {
  test(`${target.name} visual baseline`, async ({ page }, testInfo) => {
    await page.goto(target.path, { waitUntil: "networkidle" });
    if (target.view === "list") await page.getByRole("button", { name: /^(列表视图|List view)$/ }).click();
    if (target.name === "share-editor") {
      await page.getByRole("button", { name: /内容修改/ }).click();
      await page.getByRole("button", { name: /视觉设计/ }).click();
      await expect(page.locator(".share-design-workspace")).toBeVisible();
    }
    await page.addStyleTag({
      content: "*,*::before,*::after{animation-duration:0s!important;transition-duration:0s!important;caret-color:transparent!important}"
    });
    await expect(page.locator(target.ready)).toBeVisible();
    if (["data-center", "settings-data"].includes(target.name)) await page.getByTestId("storage-path").evaluate(element => { element.textContent = "C:\\CardVault\\data"; });
    if (screenshotMode === "capture") {
      // Optional local diagnostics; release and CI require comparison mode.
      await testInfo.attach(`${target.name}-${testInfo.project.name}`, {
        body: await page.screenshot({ fullPage: true }),
        contentType: "image/png"
      });
    } else {
      await expect(page).toHaveScreenshot(`${target.name}.png`, { fullPage: true });
    }
  });
}

test.describe("English interface", () => {
  test.beforeEach(async ({ context }) => {
    await context.addCookies([{
      name: "card_vault_ui_locale",
      value: "en",
      url: "http://127.0.0.1:3360",
      sameSite: "Lax"
    }]);
  });

  for (const target of englishAuditPages) {
    test(`${target.name} contains no untranslated interface text`, async ({ page }) => {
      await page.goto(target.path, { waitUntil: "networkidle" });
    if (target.view === "list") await page.getByRole("button", { name: /^(列表视图|List view)$/ }).click();
      if (target.name === "share-editor") {
        await page.getByRole("button", { name: "Edit Content" }).click();
        await expect(page.locator(".share-design-workspace")).toBeVisible();
      }
      if (target.name === "settings") {
        await page.getByRole("button", { name: "Expand AI" }).click();
        await page.getByRole("button", { name: "Expand Finance" }).click();
        await page.getByTestId("about-settings").locator("button.about-toggle").click();
        await page.getByRole("button", { name: "Release Notes" }).click();
      }
      await expect(page.locator(target.ready)).toBeVisible();
      await expect(page.locator("html")).toHaveAttribute("lang", "en");
      const untranslated = await page.locator("body").evaluate((body) => {
        const results = new Set();
        const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT);
        let node = walker.nextNode();
        while (node) {
          const parent = node.parentElement;
          const text = node.nodeValue?.trim() || "";
          if (text && /[\u3400-\u9fff]/u.test(text) && !parent?.closest("script,style,code,pre,[data-i18n-skip]")) {
            results.add(text);
          }
          node = walker.nextNode();
        }
        for (const element of body.querySelectorAll("[aria-label],[placeholder],[title]")) {
          for (const name of ["aria-label", "placeholder", "title"]) {
            const value = element.getAttribute(name);
            if (value && /[\u3400-\u9fff]/u.test(value)) results.add(`${name}: ${value}`);
          }
        }
        return [...results];
      });
      expect(untranslated, `Untranslated UI text: ${untranslated.join(" | ")}`).toEqual([]);
      expect(hanPattern.test(await page.locator("html").getAttribute("lang") || "")).toBe(false);
    });
  }

  test("language switch updates the live interface and persists the choice", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" });
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.getByRole("link", { name: "Home", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Choose language" }).click();
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.getByRole("menuitemradio", { name: "English" })).toHaveAttribute("aria-checked", "true");
    await page.getByRole("menuitemradio", { name: "English" }).press("Escape");
    await expect(page.getByRole("menu")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Choose language" })).toBeFocused();
    await page.getByRole("button", { name: "Choose language" }).click();
    await page.getByRole("menuitemradio", { name: "简体中文" }).click();
    await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
    await expect(page.getByRole("link", { name: "首页", exact: true })).toBeVisible();
    await page.reload({ waitUntil: "networkidle" });
    await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
    await page.getByRole("button", { name: "选择语言" }).click();
    await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
    await page.getByRole("menuitemradio", { name: "English" }).click();
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.getByRole("link", { name: "Home", exact: true })).toBeVisible();
  });

  test("portfolio uses one localized title per section", async ({ page }) => {
    await page.goto("/portfolio", { waitUntil: "networkidle" });
    for (const duplicateTitle of ["CURRENT PORTFOLIO", "FINANCIAL POSITION", "DATA QUALITY", "SOLD REVIEW"]) {
      await expect(page.getByText(duplicateTitle, { exact: true })).toHaveCount(0);
    }
  });
});

test("share gallery styles unify layout while themes and fine tuning remain independent", async ({ page }) => {
  await page.goto("/shares/ui-share-1/edit", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /内容修改/ }).click();
  await page.getByRole("button", { name: /视觉设计/ }).click();

  await expect(page.locator("[data-template-id]")).toHaveCount(3);
  await expect(page.getByRole("radiogroup", { name: "展馆版式" })).toHaveCount(0);
  const titleBefore = await page.locator('input[name="title"]').inputValue();
  const themeBefore = await page.locator('select[name="theme"]').inputValue();
  await page.locator('[data-template-id="archive-journal"]').click();
  await expect(page.locator('input[name="templateId"]')).toHaveValue("archive-journal");
  await expect(page.locator('input[name="layout"]')).toHaveValue("archive");
  await expect(page.locator('select[name="theme"]')).toHaveValue(themeBefore);
  await expect(page.locator('input[name="title"]')).toHaveValue(titleBefore);

  await page.getByLabel("字体风格").selectOption("modern");
  await page.getByLabel("内容密度").selectOption("compact");
  await page.getByLabel("图片构图").selectOption("contain");
  await page.getByLabel("文字面板不透明度").fill("90");
  await expect(page.locator('input[name="templateId"]')).toHaveValue("archive-journal");
  await expect(page.locator('input[name="panelOpacity"]')).toHaveValue("90");
  const preview = page.locator("iframe").contentFrame();
  await expect(preview.locator("body")).toHaveClass(/typography-modern/);
  await expect(preview.locator("body")).toHaveClass(/density-compact/);
  await expect(preview.locator("body")).toHaveClass(/image-fit-contain/);
  await expect(preview.locator("body")).toHaveAttribute("style", /--gallery-panel-alpha:0\.90/);

  await page.locator('select[name="theme"]').selectOption("basketball");
  await expect(page.locator('input[name="templateId"]')).toHaveValue("archive-journal");

  await page.getByRole("button", { name: "平板预览，768 像素" }).click();
  await expect(page.locator(".share-live-preview")).toHaveAttribute("data-preview-device", "tablet");
  await expect(page.locator(".share-live-preview")).toHaveCSS("--share-preview-width", "768px");
});

test("generated share preview fills the page canvas without redundant helper copy", async ({ page }) => {
  await page.goto("/shares/ui-share-1/preview", { waitUntil: "networkidle" });

  await expect(page.getByText("应用预览与导出使用同一套展馆渲染器", { exact: true })).toHaveCount(0);
  const viewport = page.viewportSize();
  const frameBox = await page.locator(".share-preview-frame-shell").boundingBox();
  const iframeBox = await page.locator(".share-preview-frame-shell iframe").boundingBox();
  expect(viewport).not.toBeNull();
  expect(frameBox).not.toBeNull();
  expect(iframeBox).not.toBeNull();
  expect(frameBox.width).toBeGreaterThan(viewport.width * 0.9);
  expect(iframeBox.width).toBeGreaterThan(viewport.width * 0.9);
  expect(iframeBox.height).toBeGreaterThanOrEqual(640);
});

test("share gallery wizard keeps four concise steps without redundant helper copy", async ({ page }) => {
  await page.goto("/shares/ui-share-1/edit", { waitUntil: "networkidle" });

  await expect(page.locator(".share-wizard-step")).toHaveCount(4);
  for (const helper of [
    "先挑选本次分享要展示的卡片。",
    "只会导出你勾选的卡片。价格、成本、购买渠道和备注不会进入分享包。",
    "基于已选卡片生成中文展馆标题、封面介绍、收藏叙事和分组说明。",
    "保存前确认本次分享集包含的卡片。导出包不会包含价格、成本、购买渠道和备注。"
  ]) {
    await expect(page.getByText(helper, { exact: true })).toHaveCount(0);
  }

  await page.getByRole("button", { name: /内容修改/ }).click();
  await page.getByRole("button", { name: /视觉设计/ }).click();
  await expect(page.getByText("展馆样式", { exact: true })).toBeVisible();
  await expect(page.getByText("展馆版式", { exact: true })).toHaveCount(0);
  await expect(page.getByText("分享集背景图", { exact: true })).toBeVisible();
  await expect(page.getByText("封面图", { exact: true })).toBeVisible();
});

test("share gallery featured-card story updates the live preview", async ({ page }) => {
  await page.goto("/shares/ui-share-1/edit", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /内容修改/ }).click();
  await page.getByRole("button", { name: /单卡展示/ }).click();

  const firstCard = page.locator(".share-item-edit-card").first();
  const templateBefore = await page.locator('input[name="templateId"]').inputValue();
  await firstCard.locator("textarea").fill("A featured story written for the gallery preview.");
  await firstCard.locator(".share-featured-toggle input").check();

  await expect(page.locator('input[name="featuredCardIdsJson"]')).toHaveValue(/ui-card-1/);
  await expect(page.locator('input[name="templateId"]')).toHaveValue(templateBefore);
  const preview = page.locator("iframe").contentFrame();
  await expect(preview.getByRole("heading", { name: "重点卡故事" })).toBeVisible();
  await expect(preview.locator(".featured-stories").getByText("A featured story written for the gallery preview.")).toBeVisible();
});

test("share gallery background upload can be cancelled before saving", async ({ page }) => {
  await page.goto("/shares/ui-share-1/edit", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /内容修改/ }).click();
  await page.getByRole("button", { name: /视觉设计/ }).click();

  await page.locator('input[name="backgroundImage"]').setInputFiles({
    name: "temporary-background.png",
    mimeType: "image/png",
    buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64")
  });
  const preview = page.locator("iframe").contentFrame();
  await expect(preview.locator("body")).toHaveAttribute("style", /data:image\/png;base64/);

  await page.getByRole("checkbox", { name: "取消已选择的背景图" }).check();
  await expect(preview.locator("body")).not.toHaveAttribute("style", /data:image\/png;base64/);
});

test("share editor remains usable when browser draft storage is unavailable", async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => { throw new DOMException("Storage blocked", "SecurityError"); };
    Storage.prototype.setItem = () => { throw new DOMException("Storage blocked", "SecurityError"); };
    Storage.prototype.removeItem = () => { throw new DOMException("Storage blocked", "SecurityError"); };
  });
  await page.goto("/shares/ui-share-1/edit", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /内容修改/ }).click();

  await expect(page.getByText("本机草稿不可用；修改仍可保存到分享集")).toBeVisible();
  await expect(page.locator('input[name="title"]')).toBeEditable();
});
