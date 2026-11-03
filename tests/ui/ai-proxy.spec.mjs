import { test, expect } from "@playwright/test";
for (const locale of ["zh", "en"]) test("AI proxy settings preserve per-device drafts and credential flags (" + locale + ")", async ({ page, context }) => {
  if (locale === "en") await context.addCookies([{ name: "card_vault_ui_locale", value: "en", url: "http://127.0.0.1:3360" }]);
  await page.addInitScript(() => {
    window.cardVaultDesktop = {
      getAiSettings: async () => ({ provider: "openai", customProviders: [], openai: { endpoint: "https://api.openai.com/v1/chat/completions", model: "gpt-5.4-mini", hasApiKey: true } }),
      saveAiSettings: async draft => { window.__proxyDraft = draft; return { ...draft, openai: { ...draft.openai, hasApiKey: true }, proxy: { ...draft.proxy, password: undefined, hasPassword: Boolean(draft.proxy.password) } }; }
    };
  });
  await page.route("**/api/ai/**", route => route.fulfill({ json: { ok: true, models: ["fixture"] } }));
  await page.setViewportSize({ width: 1100, height: 1000 });
  await page.goto("/settings", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: locale === "en" ? "Expand AI" : "展开 AI", exact: true }).click();
  const proxy = page.locator(".ai-proxy-settings");
  await expect(proxy.locator("summary")).toHaveText(locale === "en" ? "Network & proxy" : "网络与代理");
  await proxy.locator("summary").click();
  const mode = proxy.locator("select").first();
  await expect(mode).toHaveValue("auto");
  await expect(mode.locator('option[value="auto"]')).toHaveText(locale === "en" ? "Automatic" : "自动");
  await expect(proxy.locator("p, .muted")).toHaveCount(0);
  await mode.selectOption("manual");
  await proxy.locator("select").nth(1).selectOption("socks5");
  await proxy.getByLabel(locale === "en" ? "Proxy server address" : "代理服务器地址", { exact: true }).fill("gateway.example.com");
  await proxy.getByLabel(locale === "en" ? "Proxy port" : "代理端口", { exact: true }).fill("1091");
  await proxy.getByLabel(locale === "en" ? "Proxy username (optional)" : "代理用户名（可选）", { exact: true }).fill("collector");
  const password = proxy.locator('input[type="password"]');
  await password.fill("proxy-password");
  await mode.selectOption("direct");
  await expect(password).toHaveCount(0);
  await mode.selectOption("manual");
  await expect(password).toHaveValue("proxy-password");
  await expect(proxy.locator("p, .muted")).toHaveCount(0);
  for (const width of [1100, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const fields = await proxy.locator("input, select").evaluateAll(elements => elements.filter(element => element.checkVisibility()).map(element => {
      const rect = element.getBoundingClientRect();
      return rect.left >= 0 && rect.right <= innerWidth;
    }));
    expect(fields.every(Boolean)).toBe(true);
    await page.screenshot({ path: "logs/v1.5.1-ai-proxy-" + locale + "-" + width + ".png", fullPage: true });
  }
  await page.getByRole("button", { name: locale === "en" ? "Save Settings" : "保存设置", exact: true }).click();
  await expect(password).toHaveValue("");
  await expect(password).toHaveAttribute("placeholder", locale === "en" ? "Saved; leave blank to keep unchanged" : "已保存；留空则不修改");
  const saved = await page.evaluate(() => window.__proxyDraft);
  expect(saved.proxy).toMatchObject({ mode: "manual", protocol: "socks5", host: "gateway.example.com", port: "1091", password: "proxy-password" });
  expect(saved.openai.apiKey).toBeUndefined();
  await expect(proxy.locator('input[type="checkbox"]')).toBeVisible();
  await proxy.locator('input[type="checkbox"]').check();
  await page.getByRole("button", { name: locale === "en" ? "Save Settings" : "保存设置", exact: true }).click();
  expect((await page.evaluate(() => window.__proxyDraft)).proxy.password).toBe("");
  await page.route("**/api/ai/test-settings", route => route.fulfill({ json: { ok: true, capability: "text", route: { source: "system", connection: "proxy", protocol: "https", attempt: 1 } } }));
  await page.getByRole("button", { name: locale === "en" ? "Test Connection" : "测试连接", exact: true }).click();
  await expect(page.locator(".ai-route-result")).toHaveText(locale === "en" ? "System rule · Via proxy (HTTPS)" : "系统规则 · 经代理连接 (HTTPS)");
  await expect(page.locator(".ai-capability-result")).toHaveText(locale === "en" ? "Text connection passed; image support still needs verification." : "文本连接通过；图片识别能力需另行确认。");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  if (locale === "en") expect(await proxy.innerText()).not.toMatch(/[\u3400-\u9fff]/u);
});
