import { expect, test } from '@playwright/test';
test.use({ actionTimeout: 10_000 });

test('standalone sign-out stays visible with account settings collapsed in both languages, all themes and narrow screens', async ({ page, context, baseURL }) => {
  test.setTimeout(120000);
  for (const theme of ['classic', 'gallery', 'midnight', 'archive']) {
    for (const locale of ['zh', 'en']) {
      const english = locale === 'en';
      await context.addCookies([{ name: 'card_vault_app_theme', value: theme, url: baseURL }, { name: 'card_vault_ui_locale', value: locale, url: baseURL }]);
      await page.goto('/settings', { waitUntil: 'networkidle' });
      await expect(page.locator('.header-utilities .header-tool')).toHaveCount(2);
      await expect(page.locator('.header-utilities .header-settings')).toBeVisible();
      await expect(page.getByRole('button', { name: english ? 'Choose language' : '选择语言', exact: true })).toBeVisible();
      const expand = page.getByRole('button', { name: english ? 'Expand Account & security' : '展开账户与安全', exact: true });
      await expect(expand).toHaveAttribute('aria-expanded', 'false');
      const actions = page.locator('.settings-footer-bar');
      const signOut = actions.getByRole('button', { name: english ? 'Sign out' : '退出登录', exact: true });
      await expect(signOut).toBeVisible();
      await expect(signOut).not.toHaveAttribute('aria-expanded');
      await expect(signOut.locator('svg')).toHaveCount(0);
      await expand.click();
      await expect(page.getByRole('combobox', { name: english ? 'Manage account' : '账户管理', exact: true })).toHaveCSS('background-repeat', 'no-repeat');
      await expect(page.locator('#account-security').getByRole('button', { name: english ? 'Sign out' : '退出登录', exact: true })).toHaveCount(0);
      await page.getByRole('button', { name: english ? 'Collapse Account & security' : '收起账户与安全', exact: true }).click();
      for (const width of [1440, 390, 320]) {
        await page.setViewportSize({ width, height: 900 });
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        await expect(signOut).toBeInViewport();
        const signOutBox = await signOut.boundingBox();
        const actionsBox = await actions.boundingBox();
        const helpBox = await page.locator('.settings-help-toggle').boundingBox();
        expect(signOutBox.height).toBeGreaterThanOrEqual(40);
        expect(Math.abs(signOutBox.x + signOutBox.width - actionsBox.x - actionsBox.width)).toBeLessThan(2);
        expect(helpBox.x + helpBox.width).toBeLessThan(signOutBox.x);
        expect(Math.abs(signOutBox.y + signOutBox.height / 2 - helpBox.y - helpBox.height / 2)).toBeLessThan(2);
      }
      const before = await signOut.boundingBox();
      await page.locator('.settings-help-toggle').click();
      await expect(page.locator('.settings-help-content')).toBeVisible();
      const after = await signOut.boundingBox();
      expect(after.x).toBeCloseTo(before.x, 0);
      expect(after.y).toBeCloseTo(before.y, 0);
      await page.locator('.settings-help-toggle').click();
      await page.screenshot({ path: `logs/settings-sign-out-${theme}-${locale}.png`, fullPage: true, animations: 'disabled' });
    }
  }
});

test('legacy settings links open the correct tools and help remains reachable', async ({ page }) => {
  await page.goto('/settings#data-export', { waitUntil: 'networkidle' });
  await expect(page.locator('#data-export')).toBeVisible();
  await expect(page.locator('#data-settings > button')).toHaveAttribute('aria-expanded', 'true');
  await page.getByLabel('仅导出公开档案').check();
  await expect(page.locator('#data-maintenance')).toBeVisible();
  await page.evaluate(() => { location.hash = 'data-maintenance'; });
  await expect(page.getByRole('heading', { name: '维护', exact: true })).toBeVisible();
  await page.evaluate(() => { location.hash = 'data-export'; });
  await expect(page.getByLabel('仅导出公开档案')).toBeChecked();
  await page.evaluate(() => { location.hash = 'about-card-vault-content'; });
  await expect(page.locator('#settings-release-notes')).toBeVisible();
  await expect(page.locator('.settings-help-actions a').first()).toHaveAttribute('href', '/settings/guide');
  await page.evaluate(() => { location.hash = 'user-guide-settings'; });
  await expect(page).toHaveURL(/\/settings\/guide$/);
  await expect(page.locator('.user-guide-index a')).toHaveCount(10);
});

test('AI fields are directly visible and preserve drafts and saved keys across provider switches and folding', async ({ page }) => {
  await page.addInitScript(() => {
    window.cardVaultDesktop = {
      getAiSettings: async () => ({
        provider: 'custom', activeCustomId: 'local',
        openai: { endpoint: 'https://openai.example.test', model: 'vision', hasApiKey: true },
        minimax: { endpoint: 'https://minimax.example.test', model: 'MiniMax-VL-01', hasApiKey: true },
        deepseek: { endpoint: 'https://deepseek.example.test', model: 'deepseek-flash', hasApiKey: true },
        customProviders: [{ id: 'local', name: 'Local model', endpoint: 'https://local.example.test/v1/chat/completions', model: 'vision-local', modelsEndpoint: '', hasApiKey: true, apiKeyHeader: 'X-API-Key', apiKeyPrefix: '' }]
      }),
      saveAiSettings: async draft => {
        window.__savedAiDraft = draft;
        return { ...draft, customProviders: draft.customProviders.map(item => ({ ...item, apiKey: undefined, hasApiKey: item.apiKey !== '' })) };
      }
    };
  });
  let requested;
  await page.route('**/api/ai/models', async route => {
    requested = route.request().postDataJSON();
    await route.fulfill({ json: { models: ['vision-local', 'vision-next'] } });
  });
  await page.goto('/settings', { waitUntil: 'networkidle' });
  const toggle = page.locator('.ai-settings-panel > button');
  await toggle.click();
  await expect(page.getByLabel('Endpoint', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '新增自定义 AI', exact: true })).toBeVisible();
  await expect(page.locator('.ai-settings-panel details')).toHaveCount(0);
  await expect(page.locator('.ai-settings-fields > section h3')).toHaveText(['识别与分析','制图与合影','网络与代理']);
  await expect(page.locator('.ai-proxy-settings')).toHaveCount(1);
  await page.getByLabel('Model *', { exact: true }).fill('vision-draft');
  await page.getByLabel('API Key', { exact: true }).fill('new-mock-key');
  await page.getByLabel('Endpoint', { exact: true }).fill('https://local.example.test/alternate/chat/completions');
  await toggle.click();
  await toggle.click();
  await expect(page.getByLabel('Model *', { exact: true })).toHaveValue('vision-draft');
  await expect(page.getByLabel('API Key', { exact: true })).toHaveValue('new-mock-key');
  await expect(page.getByLabel('Endpoint', { exact: true })).toHaveValue('https://local.example.test/alternate/chat/completions');
  await page.getByRole('combobox', { name: '当前服务', exact: true }).selectOption('deepseek');
  await page.getByRole('combobox', { name: '当前服务', exact: true }).selectOption('custom:local');
  await page.getByRole('button', { name: '读取模型', exact: true }).click();
  await page.getByRole('combobox', { name: '选择模型', exact: true }).selectOption('vision-next');
  expect(requested.customProviders[0].endpoint).toBe('https://local.example.test/alternate/chat/completions');
  await page.getByLabel('保存时清除 API Key').check();
  await page.getByRole('button', { name: '保存设置', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.__savedAiDraft?.customProviders[0].apiKey)).toBe('');
  const saved = await page.evaluate(() => window.__savedAiDraft);
  expect(saved.customProviders[0]).toMatchObject({ model: 'vision-next', apiKeyHeader: 'X-API-Key', apiKeyPrefix: '' });
  expect(saved.openai.endpoint).toBe('https://openai.example.test');
  expect(saved.openai.apiKey).toBeUndefined();
  expect(saved.deepseek.apiKey).toBeUndefined();
  await page.getByRole('button', { name: '新增自定义 AI', exact: true }).click();
  await expect(page.getByLabel('显示名称 *', { exact: true })).toBeVisible();
  await page.getByLabel('显示名称 *', { exact: true }).fill('New local model');
  await page.getByLabel('Endpoint', { exact: true }).fill('https://new.example.test/v1/chat/completions');
  await page.getByLabel('Model *', { exact: true }).fill('vision-new');
  await page.getByRole('button', { name: '保存设置', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.__savedAiDraft?.customProviders.length)).toBe(2);
  await page.getByRole('button', { name: '删除当前配置', exact: true }).click();
  await page.getByRole('button', { name: '确认删除', exact: true }).click();
  await page.getByRole('button', { name: '保存设置', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.__savedAiDraft?.customProviders.map(item => item.id))).toEqual(['local']);
});
