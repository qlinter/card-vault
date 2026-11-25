import { withUiDatabase as fixture } from './database-fixture.mjs';
import { expect, test } from '@playwright/test';
test.use({ actionTimeout: 10_000 });
test.beforeEach(() => fixture(db => {
  db.prepare("INSERT INTO Card(id,playerName,cardTitle,sport,holdingQuantity) VALUES('editor-finance','Editor Player','Editor Card','Basketball',0)").run();
  db.prepare("INSERT INTO CardImage(id,cardId,path) VALUES('editor-finance-image','editor-finance','/media/ui-card-1.webp')").run();
}));
test.afterEach(() => fixture(db => db.prepare("DELETE FROM Card WHERE id='editor-finance'").run()));

test('financial records are managed on card details and image tools belong to the archive form', async ({ page }) => {
  await page.goto('/cards/editor-finance');
  const finance = page.locator('#financial-history');
  await finance.getByRole('button', { name: '新增财务记录' }).click();
  const form = finance.locator('form:visible');
  await form.locator('[name="amount"]').fill('100');
  await form.locator('[name="quantity"]').fill('1');
  await form.locator('[name="occurredAt"]').fill('2026-09-01');
  await form.getByRole('button', { name: '保存交易' }).click();
  await expect(finance.locator('.financial-history-count')).toContainText('1');
  await finance.locator('.financial-history-details > summary').click();
  await expect(finance.locator('.financial-timeline-item')).toHaveCount(1);
  await page.getByRole('link', { name: '待生成', exact: true }).click();
  await expect(page).toHaveURL(/\/edit(?:\?[^#]*)?#studio-image$/);
  await expect(page.locator('#financial-history')).toHaveCount(0);
  const editor = page.locator('.entry-page > form');
  await expect(editor.locator('#studio-image')).toBeVisible();
  await expect(editor.locator('#studio-image button:not([type="button"])')).toHaveCount(0);
  await editor.getByText('另选识别图片', { exact:true }).click();
  await editor.getByLabel('识别图片', { exact:true }).setInputFiles('tests/fixtures/ui-media/showcase-bg.webp');
  await expect(editor.locator('[name="playerName"]')).toHaveValue('Editor Player');
});

test('entry AI emphasis and unified edit actions fit all themes and both languages', async ({ page, context }, testInfo) => {
  test.setTimeout(180_000);
  for (const locale of ['zh', 'en']) for (const theme of ['classic', 'gallery', 'midnight', 'archive']) for (const width of [1100, 1440]) {
    await context.addCookies([{ name: 'card_vault_ui_locale', value: locale, url: 'http://127.0.0.1:3360' }, { name: 'card_vault_app_theme', value: theme, url: 'http://127.0.0.1:3360' }]);
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/cards/new', { waitUntil: 'networkidle' });
    const heading = page.locator('.entry-ai-primary h2');
    await expect(heading).toHaveText(locale === 'en' ? 'AI Image Entry' : 'AI 识图录入');
    await expect(heading).toHaveCSS('font-weight', '600');
    await expect(heading).toHaveCSS('font-size', '18px');
    if (theme === 'classic' && width === 1100) await page.screenshot({ path: testInfo.outputPath(`entry-ai-${locale}.png`) });
    await expect(page.locator('.ai-recognition-panel')).toBeVisible();
    expect(await page.locator('.entry-ai-primary').evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    await page.goto('/cards/editor-finance/edit', { waitUntil: 'networkidle' });
    const panel = page.locator('.entry-ai-primary');
    await expect(panel.locator('h2')).toHaveText(locale === 'en' ? 'AI Image Fill' : 'AI 识图填充');
    await expect(panel.locator('h2')).toHaveCSS('font-size', '18px');
    expect(await panel.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    await expect(page.locator('form #studio-image')).toBeVisible();
  }
  await page.goto('/', { waitUntil: 'networkidle' });
  await expect(page.locator('.collection-shortcuts a')).toHaveText(['Goals & search']);
  await page.locator('.collection-scout-link').click();
  await expect(page).toHaveURL(/\/collection\?tab=wishlist$/);
});
