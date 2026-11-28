import { test, expect } from "@playwright/test";

test("studio configuration keeps model lookup separate from paid generation and chat credentials", async ({ page }) => {
  await page.addInitScript(() => {
    window.cardVaultDesktop = {
      getAiSettings: async () => ({ provider: "deepseek", openai: { hasApiKey: true } }),
      saveAiSettings: async draft => {
        window.__studioDraft = draft;
        return { ...draft, studio: { model: draft.studio.model, keySource: draft.studio.keySource, hasApiKey: true } };
      }
    };
  });
  let checks = 0, generation = 0;
  await page.route("**/api/studio/connection", async route => {
    checks++;
    expect(route.request().postData()).toBeNull();
    await route.fulfill({ json: { result: "ready", model: "gpt-image-2" } });
  });
  await page.route("**/api/studio", async route => {
    if (route.request().method() === "POST") generation++;
    await route.fulfill({ json: { ready: generation, pending: generation ? [] : ["fixture"], missingFront: 0 } });
  });
  await page.goto("/settings?section=ai#ai-settings");
  const panel = page.locator(".studio-configuration");
  await expect(panel.getByLabel("密钥来源")).toHaveValue("openai");
  await expect(panel.getByLabel("图片模型")).toHaveValue("gpt-image-2");
  await panel.getByRole("button", { name:"检查已保存模型" }).click();
  await expect(panel.getByText("模型可访问 · gpt-image-2")).toBeVisible();
  const chatKey = page.getByLabel("API Key", { exact: true });
  const proxy = page.locator(".ai-proxy-settings");
  await chatKey.fill("fixture-pending-chat-key");
  await proxy.getByLabel("连接方式").selectOption("manual");
  await proxy.getByLabel("代理密码（可选）").fill("fixture-pending-proxy-password");
  await panel.getByLabel("密钥来源").selectOption("independent");
  await panel.getByLabel("生图专用密钥").fill("fixture-studio");
  await page.getByRole("button", { name:"保存设置", exact:true }).and(page.locator('[data-save-section="studio"]')).click();
  expect(await page.evaluate(() => window.__studioDraft.studio)).toEqual({ model: "gpt-image-2", keySource: "independent", apiKey: "fixture-studio" });
  await expect(panel.getByLabel("生图专用密钥")).toHaveValue("");
  expect(await page.evaluate(() => Object.keys(window.__studioDraft))).toEqual(["studio"]);
  await expect(chatKey).toHaveValue("fixture-pending-chat-key");
  await expect(proxy.getByLabel("代理密码（可选）")).toHaveValue("fixture-pending-proxy-password");
  await proxy.getByLabel("连接方式").selectOption("auto");
  const fields = page.locator(".ai-settings-fields");
  const headings = fields.locator(":scope > section h3");
  await expect(headings).toHaveText(["识别与分析", "制图与合影", "网络与代理"]);
  await expect(fields.locator("details, summary")).toHaveCount(0);
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    const styles = await headings.evaluateAll(nodes => nodes.map(el => getComputedStyle(el).font));
    expect(new Set(styles).size).toBe(1);
    expect(await fields.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    for (const row of await fields.locator(".ai-actions").all()) {
      const buttons = row.getByRole("button");
      await expect(buttons.last()).toHaveText("保存设置");
      const box = await buttons.last().boundingBox();
      const rowBox = await row.boundingBox();
      const gap = await row.evaluate(el => parseFloat(getComputedStyle(el).columnGap));
      let expectedX = rowBox.x;
      for (const peer of await buttons.all()) {
        const bounds = await peer.boundingBox();
        expect(Math.abs(bounds.x - expectedX)).toBeLessThan(1);
        expectedX = bounds.x + bounds.width + gap;
        expect(Math.abs(bounds.y - box.y)).toBeLessThan(1);
        expect(Math.abs(bounds.height - box.height)).toBeLessThan(1);
      }
    }
    await fields.screenshot({ path: `logs/v172-ai-sections-${width}.png`, style: ".topbar { visibility: hidden; }" });
  }
  expect(checks).toBe(1);
  expect(generation).toBe(0);
  const pending = page.locator(".studio-pending-group");
  await expect(pending.getByRole("status")).toHaveText("待生成 1");
  await pending.getByRole("button",{name:"补生成展馆图"}).click();
  await expect(pending.getByRole("status")).toHaveText("待生成 0");
  await expect(pending.getByRole("button")).toHaveCount(0);
  expect(generation).toBe(1);
});
