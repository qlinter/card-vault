import { expect, test } from "@playwright/test";

const routes = ["/", "/cards/new", "/cards/ui-card-1", "/cards/ui-card-1/edit", "/portfolio", "/portfolio?tab=trends", "/portfolio?tab=structure", "/portfolio?tab=details", "/portfolio/recap", "/showcase", "/showcase/cards/ui-card-1", "/shares", "/shares/new", "/settings", "/settings/data", "/settings/guide", "/settings/finance-rules", "/collection"];
const family = 'Arial, "Microsoft YaHei", sans-serif';

for (const locale of ["zh-CN", "en"]) test(`shared typography, buttons and fields agree across application pages (${locale})`, async ({ page, context }) => {
  test.setTimeout(120000);
  const findings = [];
  await context.addCookies([{ name: "card_vault_ui_locale", value: locale, url: "http://127.0.0.1:3360" }]);
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const route of routes) {
    await page.goto(route, { waitUntil: "networkidle" });
    await expect(page.locator("body")).toHaveCSS("font-family", family);
    await expect(page.locator("body")).toHaveCSS("font-size", "14px");
    const violations = await page.locator(".btn").evaluateAll(elements => elements.filter(element => element.getClientRects().length && !element.closest(".card-image-rotation-actions")).flatMap(element => {
      const s = getComputedStyle(element), min = parseFloat(s.minHeight);
      const expectedSize = min === 36 ? "13px" : "14px";
      return s.fontFamily !== 'Arial, "Microsoft YaHei", sans-serif' || s.fontWeight !== "500" || s.borderRadius !== "8px" || ![36, 40].includes(min) || s.fontSize !== expectedSize ? [{ text: element.textContent.trim().slice(0, 50), font: s.font, radius: s.borderRadius, min }] : [];
    }));
    if (violations.length) findings.push({ route, buttons: violations });
    const fields = await page.locator('input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=hidden]):not([type=file]):not([type=color]), select, textarea').evaluateAll(elements => elements.filter(element => element.getClientRects().length && !element.closest(".recap-title-label,.home-summary-grid")).flatMap(element => {
      const s = getComputedStyle(element);
      return s.fontFamily !== 'Arial, "Microsoft YaHei", sans-serif' || s.fontSize !== "14px" || s.fontWeight !== "400" ? [{ name: element.getAttribute("name"), font: s.font }] : [];
    }));
    if (fields.length) findings.push({ route, fields });
    const checks = await page.locator('input[type=checkbox], input[type=radio]').evaluateAll(elements => elements.filter(element => element.getClientRects().length).flatMap(element => {
      const s = getComputedStyle(element); return s.width !== "18px" || s.height !== "18px" ? [{ width: s.width, height: s.height }] : [];
    }));
    if (checks.length) findings.push({ route, checks });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), route).toBe(true);
  }
  expect(findings).toEqual([]);
});

test("page and section headings retain their hierarchy in all application themes", async ({ page, context }) => {
  test.setTimeout(120000);
  for (const theme of ["classic", "gallery", "midnight", "archive"]) {
    await context.addCookies([{ name: "card_vault_app_theme", value: theme, url: "http://127.0.0.1:3360" }]);
    for (const route of ["/cards/new", "/shares/new", "/settings", "/settings/data", "/settings/guide", "/portfolio/recap"]) {
      await page.goto(route, { waitUntil: "networkidle" });
      const title = page.locator("h1").filter({ visible: true }).first();
      expect(await title.evaluate(element => parseFloat(getComputedStyle(element).fontSize)), route).toBeGreaterThanOrEqual(28);
      expect(await title.evaluate(element => parseFloat(getComputedStyle(element).fontSize)), route).toBeLessThanOrEqual(36);
      await expect(title).toHaveCSS("font-weight", "700");
      const headings = await page.locator(".settings-section h2,.management-section h2,.recap-panel h2").evaluateAll(elements => elements.filter(element => element.getClientRects().length).map(element => ({ size: getComputedStyle(element).fontSize, weight: getComputedStyle(element).fontWeight })));
      for (const heading of headings) expect(heading, route).toEqual({ size: "18px", weight: "600" });
    }
  }
});

test("matching view switches have matching icon geometry", async ({ page }) => {
  const snapshots = [];
  for (const route of ["/", "/showcase"]) {
    await page.goto(route);
    snapshots.push(await page.locator(".view-mode-toggle button").first().evaluate(element => { const s = getComputedStyle(element); return { width: s.width, height: s.height, radius: s.borderRadius }; }));
  }
  expect(snapshots[0]).toEqual(snapshots[1]);
  expect(snapshots[0]).toEqual({ width: "32px", height: "32px", radius: "8px" });
});

test("primary action text remains readable in every application theme", async ({ page, context }) => {
  function luminance(color) {
    const [r, g, b] = color.match(/[\d.]+/g).slice(0, 3).map(Number).map(value => { const v = value / 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; });
    return .2126 * r + .7152 * g + .0722 * b;
  }
  for (const theme of ["classic", "gallery", "midnight", "archive"]) {
    await context.addCookies([{ name: "card_vault_app_theme", value: theme, url: "http://127.0.0.1:3360" }]);
    await page.goto("/cards/new", { waitUntil: "networkidle" });
    const palette = await page.locator(".btn-primary").first().evaluate(element => { const s = getComputedStyle(element); return [s.color, s.backgroundColor]; });
    const [a, b] = palette.map(luminance);
    expect((Math.max(a, b) + .05) / (Math.min(a, b) + .05), theme).toBeGreaterThanOrEqual(4.5);
  }
});

test("analysis dialog shares UI typography and the SVG close icon", async ({ page }) => {
  await page.route("**/api/ai/portfolio-analysis", route => route.fulfill({ status: 503, json: { error: "Synthetic unavailable response" } }));
  await page.goto("/portfolio", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "组合分析", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "组合分析", exact: true });
  const title = dialog.getByRole("heading", { name: "组合分析", exact: true });
  await expect(title).toHaveCSS("font-family", family); await expect(title).toHaveCSS("font-size", "24px");
  await expect(title).toHaveCSS("font-weight", "600"); await expect(title).toHaveCSS("line-height", "31.2px");
  await expect(dialog.getByRole("button", { name: "关闭组合分析", exact: true }).locator("svg.showcase-icon")).toBeVisible();
});
