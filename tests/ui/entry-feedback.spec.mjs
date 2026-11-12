import { expect, test } from '@playwright/test';
import { withUiDatabase as fixture } from './database-fixture.mjs';

const image = 'tests/fixtures/ui-media/showcase-bg.webp';

test('draft deletion recovers from network and non-JSON failures without losing the draft', async ({ page, context, baseURL }) => {
  fixture(db => db.prepare('INSERT INTO CardEntryDraft(id, valuesJson, createdAt, updatedAt) VALUES(?,?,?,?)')
    .run('entry-feedback-delete', JSON.stringify({ playerName: 'Entry Feedback Draft' }), new Date().toISOString(), new Date().toISOString()));
  await context.addCookies([{ name: 'card_vault_ui_locale', value: 'en', url: baseURL }]);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  let attempts = 0;
  await page.route('**/api/card-entry/drafts/entry-feedback-delete', route => {
    attempts++;
    if (attempts === 1) return route.abort();
    if (attempts === 2) return route.fulfill({ status: 503, contentType: 'text/html', body: 'Unavailable' });
    return route.continue();
  });
  await page.goto('/cards/new', { waitUntil: 'networkidle' });
  await page.locator('.entry-draft-panel > summary').click();
  const row = page.locator('.entry-draft-item').filter({ hasText: 'Entry Feedback Draft' });
  const remove = row.getByRole('button');
  await remove.click();
  await expect(page.locator('.entry-draft-status')).toContainText('Could not delete the draft. Please try again.');
  await expect(remove).toBeEnabled();
  await remove.click();
  await expect(page.locator('.entry-draft-status')).toContainText('Failed to delete the draft.');
  await expect(remove).toBeEnabled();
  await remove.click();
  await expect(row).toHaveCount(0);
  expect(attempts).toBe(3);
  expect(errors).toEqual([]);
});
test.afterEach(() => fixture(db => {
  db.prepare("DELETE FROM Card WHERE playerName LIKE 'Entry Feedback%'").run();
  db.prepare("DELETE FROM CardEntryDraft WHERE valuesJson LIKE '%Entry Feedback%'").run();
}));

for (const locale of ['zh', 'en']) {
  test(`missing images are visible beside Save and can be corrected after AI recognition (${locale})`, async ({ page, context, baseURL }, testInfo) => {
    if (locale === 'en') await context.addCookies([{ name: 'card_vault_ui_locale', value: 'en', url: baseURL }]);
    let saves = 0;
    page.on('request', request => { if (request.method() === 'POST' && new URL(request.url()).pathname === '/cards/new') saves++; });
    let recognitionRequests = 0;
    await page.route('**/api/ai/recognize-card', route => ++recognitionRequests === 1
      ? route.fulfill({ status: 503, json: { error: 'AI recognition temporarily unavailable.' } })
      : route.fulfill({ json: { suggestion: { playerName: 'Entry Feedback AI', cardTitle: 'AI candidate', sport: 'Basketball' } } }));
    await page.goto('/cards/new', { waitUntil: 'networkidle' });
    const ai = page.locator('.entry-ai-primary');
    await expect(ai).toBeInViewport();
    await expect(ai.locator('h2')).toHaveText(locale === 'en' ? 'AI Image Entry' : 'AI 识图录入');
    const recognize = ai.getByRole('button', { name: locale === 'en' ? 'Recognize and Apply' : '识别并填入', exact: true });
    await recognize.click();
    await expect(ai.getByRole('alert')).toBeVisible();
    if (locale === 'en') await expect(ai.getByRole('alert')).toHaveText('Choose one or two images for AI recognition, or use the existing default images.');
    expect(recognitionRequests).toBe(0);
    await ai.locator('input[type=file]').setInputFiles(image);
    await recognize.click();
    await expect(ai.getByRole('alert')).toHaveText('AI recognition temporarily unavailable.');
    await recognize.click();
    await expect(page.locator('[name=playerName]')).toHaveValue('Entry Feedback AI');
    const save = page.getByRole('button', { name: locale === 'en' ? 'Save and View' : '保存并查看', exact: true });
    await save.click();
    const error = page.locator('.card-form-error');
    await expect(error).toHaveAttribute('role', 'alert');
    await expect(error).toContainText(locale === 'en' ? 'Upload at least one image.' : '至少上传 1 张图片。');
    await expect(error).toBeInViewport();
    await expect(error).toBeFocused();
    expect(saves).toBe(0);
    await page.screenshot({ path: testInfo.outputPath(`entry-error-${locale}.png`) });
    await error.getByRole('button').click();
    const images = page.locator('[data-card-entry-form] [name=images]');
    await expect(images).toBeFocused();
    await images.setInputFiles(image);
    await save.click();
    await expect(page).toHaveURL(/\/cards\/[^/]+\?success=created/);
    expect(saves).toBe(1);
  });

  test(`required fields and server failures retain inputs with reachable feedback (${locale})`, async ({ page, context, baseURL }) => {
    if (locale === 'en') await context.addCookies([{ name: 'card_vault_ui_locale', value: 'en', url: baseURL }]);
    await page.route('**/api/card-entry/drafts', route => route.fulfill({ json: { id: `entry-feedback-${locale}`, updatedAt: new Date().toISOString() } }));
    await page.goto('/cards/new', { waitUntil: 'networkidle' });
    const images = page.locator('[data-card-entry-form] [name=images]');
    await images.setInputFiles(image);
    const subject = page.locator('[name=playerName]');
    await subject.evaluate(element => {
      const help = document.createElement('span');
      help.id = 'entry-subject-help'; help.hidden = true; help.textContent = 'Subject help';
      element.parentElement.appendChild(help);
      element.setAttribute('aria-describedby', help.id);
    });
    const save = page.getByRole('button', { name: locale === 'en' ? 'Save and View' : '保存并查看', exact: true });
    await save.click();
    const error = page.locator('.card-form-error');
    await expect(error).toContainText(locale === 'en' ? 'Enter the card subject.' : '请填写卡片主体。');
    await expect(error).toBeInViewport();
    await expect(subject).toHaveAttribute('aria-describedby', 'entry-subject-help card-entry-save-error');
    await page.locator('[name=playerName]').fill('   ');
    await expect(subject).toHaveAttribute('aria-describedby', 'entry-subject-help');
    await page.locator('[name=cardTitle]').fill('Retained entry');
    await page.locator('[name=sport]').fill('Basketball');
    await save.click();
    await expect(error).toBeFocused();
    await expect(error).toContainText(locale === 'en' ? 'Enter the card subject.' : '请填写卡片主体。');
    await page.locator('[name=playerName]').fill('Entry Feedback Retry');
    await images.setInputFiles({ name: 'broken.png', mimeType: 'image/png', buffer: Buffer.from([137,80,78,71,13,10,26,10]) });
    for (let attempt = 0; attempt < 2; attempt++) {
      await save.click();
      await expect(error).toContainText(locale === 'en' ? 'could not be decoded' : '无法解码');
      await expect(error).toBeInViewport();
      await expect(error).toBeFocused();
      await expect(page.locator('[name=cardTitle]')).toHaveValue('Retained entry');
      expect(await images.evaluate(input => input.files.length)).toBe(1);
      expect(fixture(db => db.prepare("SELECT count(*) n FROM Card WHERE playerName='Entry Feedback Retry'").get().n)).toBe(0);
    }
    await images.setInputFiles(image);
    await save.click();
    await expect(page).toHaveURL(/\/cards\/[^/]+\?success=created/);
  });
}
