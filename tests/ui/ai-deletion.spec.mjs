import { expect, test } from '@playwright/test';

for (const locale of ['zh', 'en']) test(`AI deletion keeps editing usable without native dialogs (${locale})`, async ({ page, context }) => {
  if (locale === 'en') await context.addCookies([{ name: 'card_vault_ui_locale', value: 'en', url: 'http://127.0.0.1:3360' }]);
  const l = (zh, en) => locale === 'en' ? en : zh;
  await page.addInitScript(() => {
    window.__nativeConfirmCalls = 0;
    window.confirm = () => { window.__nativeConfirmCalls++; return false; };
    window.cardVaultDesktop = {
      getAiSettings: async () => ({ provider: 'custom', activeCustomId: 'a', customProviders: ['a', 'b'].map(id => ({
        id, name: `Fixture ${id}`, endpoint: 'http://127.0.0.1:1/v1/chat/completions', model: id, modelsEndpoint: '', apiKeyHeader: 'Authorization', apiKeyPrefix: 'Bearer', hasApiKey: false
      })) }),
      saveAiSettings: async draft => { window.__savedAiDraft = draft; return draft; }
    };
  });
  await page.goto('/settings', { waitUntil: 'networkidle' });
  await page.locator('.ai-settings-panel > button').click();
  const service = page.getByRole('combobox', { name: l('当前服务', 'Current Service'), exact: true });
  const remove = page.getByRole('button', { name: l('删除当前配置', 'Delete Current Configuration'), exact: true });
  const confirmation = page.getByRole('group', { name: l('删除自定义配置确认', 'Confirm Custom Configuration Deletion'), exact: true });
  const cancel = confirmation.getByRole('button', { name: l('取消', 'Cancel'), exact: true });
  const confirm = confirmation.getByRole('button', { name: l('确认删除', 'Confirm Deletion'), exact: true });

  await remove.click();
  expect(await page.evaluate(() => window.__nativeConfirmCalls)).toBe(0);
  await expect(confirmation).toBeVisible();
  await expect(cancel).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(confirmation).toHaveCount(0);
  await expect(remove).toBeFocused();
  await expect(service).toHaveValue('custom:a');

  // Switching services must dismiss the old question rather than delete a new selection.
  await remove.click();
  await service.selectOption('custom:b');
  await expect(confirmation).toHaveCount(0);
  await remove.click();
  await expect(confirmation).toContainText('Fixture b');
  await cancel.click();
  await expect(service).toHaveValue('custom:b');
  await remove.click();
  await confirm.click();
  await expect(service).toHaveValue('custom:a');
  await expect(service).toBeFocused();
  const model = page.getByLabel('Model *', { exact: true });
  await model.click(); await model.press('End'); await model.pressSequentially('-editable');
  await expect(model).toHaveValue('a-editable');

  await remove.click();
  await confirm.click();
  await expect(service).toHaveValue('openai');
  const builtinModel = page.getByLabel('Model', { exact: true });
  await builtinModel.click(); await builtinModel.press('ControlOrMeta+A'); await builtinModel.pressSequentially('fixture-openai');
  await expect(builtinModel).toHaveValue('fixture-openai');
  await service.selectOption('deepseek');
  await page.getByLabel('Model', { exact: true }).fill('fixture-deepseek');
  await page.getByRole('button', { name: l('保存设置', 'Save Settings'), exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.__savedAiDraft?.customProviders)).toEqual([]);
  await expect(service).toBeEnabled();
  expect(await page.evaluate(() => window.__nativeConfirmCalls)).toBe(0);
  await page.getByRole('button', { name: l('新增自定义 AI', 'Add Custom AI'), exact: true }).click();
  await expect(page.getByLabel(l('显示名称 *', 'Display Name *'), { exact: true })).toBeEditable();
});
