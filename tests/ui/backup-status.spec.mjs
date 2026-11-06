import { expect, test } from '@playwright/test';

for (const locale of ['zh', 'en']) test(`backup status waits for a successful read and updates after first backup (${locale})`, async ({ page, context, baseURL }) => {
  if (locale === 'en') await context.addCookies([{ name: 'card_vault_ui_locale', value: 'en', url: baseURL }]);
  await page.addInitScript(() => {
    let loaded = false, lastBackup = null;
    window.cardVaultDesktop = {
      onStorageProgress: () => () => {},
      getBackupSettings: async () => loaded ? { path: 'D:\\Backups', lastBackup } : new Promise(resolve => {
        window.resolveBackupSettings = () => { loaded = true; resolve({ path: 'D:\\Backups', lastBackup }); };
      }),
      backupDataFolder: async () => {
        lastBackup = { createdAt: new Date().toISOString(), bytes: 1048576, imageCount: 3, available: true };
        return { backupRoot: 'D:\\Backups', backupPath: 'D:\\Backups\\first' };
      }
    };
  });
  await page.goto('/settings#data-settings');
  const backup = page.locator('.backup-settings');
  await expect.poll(() => page.evaluate(() => typeof window.resolveBackupSettings)).toBe('function');
  await expect(backup.getByRole('status')).toHaveCount(0);
  await page.evaluate(() => window.resolveBackupSettings());
  const empty = locale === 'en' ? 'This collection has no successful backup yet.' : '当前收藏库尚无成功备份记录。';
  await expect(backup.getByRole('status')).toHaveText(empty);
  await backup.getByRole('button', { name: locale === 'en' ? 'Create Backup' : '一键备份', exact: true }).click();
  await expect(backup.getByRole('status')).not.toContainText(empty);
  await expect(backup.getByRole('status')).toContainText(locale === 'en' ? '3 images' : '3 张图片');
  await expect(backup.getByRole('status')).toContainText(locale === 'en' ? 'Integrity' : '完整性校验');
});

for (const mode of ['unavailable', 'failed']) test(`backup does not claim an empty history when settings are ${mode}`, async ({ page }) => {
  if (mode === 'failed') await page.addInitScript(() => {
    window.cardVaultDesktop = { onStorageProgress: () => () => {}, getBackupSettings: async () => { throw new Error('read failed'); } };
  });
  await page.goto('/settings#data-settings');
  const backup = page.locator('.backup-settings');
  await expect(backup).toContainText(mode === 'failed' ? '读取备份路径失败。' : '当前运行环境不支持本地备份。');
  await expect(backup.getByRole('status')).toHaveCount(0);
  await expect(backup).not.toContainText('当前收藏库尚无成功备份记录');
});
