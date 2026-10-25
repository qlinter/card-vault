import { expect, test } from '@playwright/test';
test.use({ actionTimeout: 10_000 });

test('legacy settings links open the correct tools and help remains reachable', async ({ page }) => {
  await page.goto('/settings#data-export', { waitUntil: 'networkidle' });
  await expect(page.locator('#data-export')).toBeVisible();
  await expect(page.locator('#data-settings > button')).toHaveAttribute('aria-expanded', 'true');
  await page.getByLabel('仅导出公开档案').check();
  await page.locator('#data-transfer > button').click();
  await expect(page.locator('#data-export')).toBeHidden();
  await page.evaluate(() => { location.hash = 'data-maintenance'; });
  await expect(page.getByRole('heading', { name: '存储', exact: true })).toBeVisible();
  await page.evaluate(() => { location.hash = 'data-export'; });
  await expect(page.getByLabel('仅导出公开档案')).toBeChecked();
  await page.evaluate(() => { location.hash = 'about-card-vault-content'; });
  await expect(page.locator('#settings-release-notes')).toBeVisible();
  await expect(page.locator('.settings-help-actions a').first()).toHaveAttribute('href', '/settings/guide');
  await page.evaluate(() => { location.hash = 'user-guide-settings'; });
  await expect(page).toHaveURL(/\/settings\/guide$/);
  await expect(page.locator('.user-guide-index a')).toHaveCount(9);
});

test('AI fields are directly visible and preserve drafts and saved keys across provider switches and folding', async ({ page }) => {
  await page.addInitScript(() => {
    window.cardVaultDesktop = {
      getAiSettings: async () => ({
        provider: 'custom', activeCustomId: 'local',
        azure: { endpoint: 'https://azure.example.test', deployment: 'vision', hasApiKey: true },
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
  expect(saved.azure.endpoint).toBe('https://azure.example.test');
  expect(saved.azure.apiKey).toBeUndefined();
  expect(saved.deepseek.apiKey).toBeUndefined();
  await page.getByRole('button', { name: '新增自定义 AI', exact: true }).click();
  await expect(page.getByLabel('显示名称 *', { exact: true })).toBeVisible();
  await page.getByLabel('显示名称 *', { exact: true }).fill('New local model');
  await page.getByLabel('Endpoint', { exact: true }).fill('https://new.example.test/v1/chat/completions');
  await page.getByLabel('Model *', { exact: true }).fill('vision-new');
  await page.getByRole('button', { name: '保存设置', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.__savedAiDraft?.customProviders.length)).toBe(2);
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: '删除当前配置', exact: true }).click();
  await page.getByRole('button', { name: '保存设置', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.__savedAiDraft?.customProviders.map(item => item.id))).toEqual(['local']);
});
