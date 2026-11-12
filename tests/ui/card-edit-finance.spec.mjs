import { withUiDatabase as fixture } from './database-fixture.mjs';
import { expect, test } from '@playwright/test';
test.use({ actionTimeout: 10_000 });
test.beforeEach(() => fixture(db => {
  db.prepare("INSERT INTO Card(id,playerName,cardTitle,sport,holdingQuantity) VALUES('editor-finance','Editor Player','Editor Card','Basketball',0)").run();
  db.prepare("INSERT INTO CardImage(id,cardId,path) VALUES('editor-finance-image','editor-finance','/media/ui-card-1.webp')").run();
}));
test.afterEach(() => fixture(db => db.prepare("DELETE FROM Card WHERE id='editor-finance'").run()));

test('edit-page financial records save independently while preserving unsaved archive fields', async ({ page }) => {
  const returnTo = '/portfolio?tab=details&q=Editor';
  await page.goto('/cards/editor-finance/edit?returnTo=' + encodeURIComponent(returnTo), { waitUntil: 'networkidle' });
  const archive = page.locator('.entry-page > form');
  const finance = page.locator('.entry-page > .financial-history');
  await expect(finance.locator('.financial-history-actions button')).toHaveText(['新增财务记录']);
  await expect(page.locator('form form')).toHaveCount(0);
  await archive.locator('[name="playerName"]').fill('Unsubmitted archive draft');
  await archive.locator('[name="cardTitle"]').fill('Unsubmitted card title');
  async function open(label) {
    await finance.getByRole('button', { name: '新增财务记录', exact: true }).click();
    await finance.getByRole('combobox', { name: '录入类型', exact: true }).selectOption({ label });
    return finance.locator('form:visible');
  }
  async function saved() {
    await expect(finance.getByRole('status')).toHaveText('财务记录已保存。');
    expect(new URL(page.url()).pathname).toBe('/cards/editor-finance/edit');
    await expect(archive.locator('[name="playerName"]')).toHaveValue('Unsubmitted archive draft');
    await expect(archive.locator('[name="cardTitle"]')).toHaveValue('Unsubmitted card title');
    expect(fixture(db => db.prepare("SELECT playerName FROM Card WHERE id='editor-finance'").get().playerName)).toBe('Editor Player');
  }
  const purchaseDraft = await open('买入');
  await purchaseDraft.locator('[name="amount"]').fill('55');
  await finance.getByRole('combobox', { name: '录入类型', exact: true }).selectOption('expense');
  await finance.locator('form:visible [name="amount"]').fill('12');
  await finance.getByRole('combobox', { name: '录入类型', exact: true }).selectOption('purchase');
  await expect(purchaseDraft.locator('[name="amount"]')).toHaveValue('55');
  await expect(purchaseDraft.locator('select[name="kind"]')).toHaveCount(0);
  await finance.getByRole('button', { name: '收起', exact: true }).click();
  await open('买入');
  await expect(purchaseDraft.locator('[name="amount"]')).toHaveValue('55');
  await finance.getByRole('button', { name: '收起', exact: true }).click();
  for (const [index, quantity] of [2, 1].entries()) {
    const form = await open('买入');
    await form.locator('[name="amount"]').fill('100');
    await form.locator('[name="quantity"]').fill(String(quantity));
    await form.locator('[name="occurredAt"]').fill(`2026-09-0${index + 1}`);
    await form.getByRole('button', { name: '保存交易' }).click();
    await saved();
  }
  let form = await open('费用');
  await form.locator('[name="amount"]').fill('10');
  await form.locator('[name="occurredAt"]').fill('2026-09-03');
  await form.getByRole('button', { name: '保存费用' }).click();
  await saved();
  form = await open('估值');
  await form.locator('[name="amount"]').fill('250');
  await form.locator('[name="valuedAt"]').fill('2026-09-04');
  await form.getByRole('button', { name: '保存估值' }).click();
  await saved();
  form = await open('卖出');
  await form.locator('[name="amount"]').fill('400');
  await form.locator('[name="quantity"]').fill('4');
  await form.locator('[name="occurredAt"]').fill('2026-09-05');
  await form.getByRole('button', { name: '保存交易' }).click();
  await expect(form.getByRole('alert')).toBeVisible();
  await expect(form.locator('[name="quantity"]')).toHaveValue('4');
  await expect(form.locator('[name="amount"]')).toHaveValue('400');
  await form.locator('[name="quantity"]').fill('1');
  await form.getByRole('button', { name: '保存交易' }).click();
  await saved();
  await archive.getByRole('button', { name: '保存修改' }).click();
  await expect(page).toHaveURL(/\/cards\/editor-finance\?/);
  expect(new URL(page.url()).searchParams.get('returnTo')).toBe(returnTo);
  expect(fixture(db => db.prepare("SELECT playerName,holdingQuantity FROM Card WHERE id='editor-finance'").get())).toMatchObject({ playerName: 'Unsubmitted archive draft', holdingQuantity: 2 });
  expect(fixture(db => ['CardTransaction', 'CardExpense', 'CardValuation'].map(table => db.prepare(`SELECT COUNT(*) n FROM ${table} WHERE cardId='editor-finance'`).get().n))).toEqual([3, 1, 1]);
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
    const panel = page.locator('.entry-page > .financial-history');
    await expect(panel.locator('.financial-history-actions button')).toHaveText([locale === 'en' ? 'Add Financial Record' : '新增财务记录']);
    await panel.locator('.financial-add-trigger').click();
    const type = panel.getByRole('combobox', { name: locale === 'en' ? 'Record type' : '录入类型', exact: true });
    await expect(type.locator('option')).toHaveText(locale === 'en' ? ['Purchase', 'Sale', 'Expense', 'Valuation'] : ['买入', '卖出', '费用', '估值']);
    expect(await panel.evaluate(element => [...element.querySelectorAll('button')].filter(button => button.checkVisibility()).every(button => { const b = button.getBoundingClientRect(), p = element.getBoundingClientRect(); return b.left >= p.left && b.right <= p.right; }))).toBe(true);
    if (theme === 'classic' && width === 1100) await panel.screenshot({ path: testInfo.outputPath(`edit-finance-${locale}.png`) });
  }
  await page.goto('/', { waitUntil: 'networkidle' });
  await expect(page.locator('.collection-shortcuts a')).toHaveText(['Goals & search']);
  await page.locator('.collection-scout-link').click();
  await expect(page).toHaveURL(/\/collection\?tab=wishlist$/);
});
