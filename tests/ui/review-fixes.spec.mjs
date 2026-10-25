import { withUiDatabase as fixture } from './database-fixture.mjs';
import { expect, test } from '@playwright/test';
test.afterEach(() => fixture(db => db.exec("DELETE FROM ShareCollection WHERE id='review-share'; DELETE FROM Card WHERE id LIKE 'review-%'")));

test('financial saves synchronize sold and repurchased status and retain other record drafts', async ({ page }) => {
  fixture(db => db.exec(`
    INSERT INTO Card(id,playerName,cardTitle,sport,holdingQuantity) VALUES('review-finance','Review Player','Review Card','Basketball',2);
    INSERT INTO CardImage(id,cardId,path) VALUES('review-image','review-finance','/media/ui-card-1.webp');
    INSERT INTO CardTransaction(id,cardId,kind,amountMinor,currency,quantity,occurredAt,provenance) VALUES('review-buy','review-finance','purchase',10000,'CNY',2,'2026-09-01T00:00:00.000Z','ui-test');
  `));
  await page.goto('/cards/review-finance/edit', { waitUntil: 'networkidle' });
  const archive = page.locator('.entry-page > form');
  const finance = page.locator('.financial-history');
  await archive.locator('[name=playerName]').fill('Preserved archive draft');
  async function open(kind) {
    await finance.locator('.financial-add-trigger').click();
    await finance.getByRole('combobox', { name: '录入类型', exact: true }).selectOption(kind);
    return finance.locator('form:visible');
  }
  await open('expense');
  await finance.locator('form:visible [name=amount]').fill('37');
  await finance.getByRole('combobox', { name: '录入类型', exact: true }).selectOption('sale');
  let form = finance.locator('form:visible');
  await form.locator('[name=amount]').fill('500');
  await form.locator('[name=quantity]').fill('2');
  await form.locator('[name=occurredAt]').fill('2026-10-01');
  await form.getByRole('button', { name: '保存交易', exact: true }).click();
  await expect(finance.getByRole('status')).toHaveText('财务记录已保存。');
  await expect(archive.locator('[name=collectionStatus]')).toHaveValue('sold');
  await expect(archive.locator('[name=playerName]')).toHaveValue('Preserved archive draft');
  form = await open('expense');
  await expect(form.locator('[name=amount]')).toHaveValue('37');
  await form.locator('[name=context]').selectOption('sale');
  const saleId = fixture(db => db.prepare("SELECT id FROM CardTransaction WHERE cardId='review-finance' AND kind='sale'").get().id);
  await form.locator('[name=transactionId]').selectOption(saleId);
  await form.locator('[name=occurredAt]').fill('2026-10-01');
  await form.getByRole('button', { name: '保存费用', exact: true }).click();
  await expect(finance.getByRole('status')).toHaveText('财务记录已保存。');
  expect(fixture(db => db.prepare("SELECT transactionId FROM CardExpense WHERE cardId='review-finance'").get().transactionId)).toBe(saleId);
  await archive.getByRole('button', { name: '保存修改', exact: true }).click();
  await expect(page).toHaveURL(/\/cards\/review-finance\?/);
  expect(fixture(db => db.prepare("SELECT collectionStatus,holdingQuantity,playerName FROM Card WHERE id='review-finance'").get())).toMatchObject({collectionStatus:'sold',holdingQuantity:0,playerName:'Preserved archive draft'});
  await page.goto('/cards/review-finance/edit', { waitUntil: 'networkidle' });
  await archive.locator('[name=playerName]').fill('Repurchased archive draft');
  form = await open('purchase');
  await form.locator('[name=amount]').fill('90');
  await form.locator('[name=occurredAt]').fill('2026-10-02');
  await form.getByRole('button', { name: '保存交易', exact: true }).click();
  await expect(finance.getByRole('status')).toHaveText('财务记录已保存。');
  await expect(archive.locator('[name=collectionStatus]')).toHaveValue('holding');
  await expect(archive.locator('[name=playerName]')).toHaveValue('Repurchased archive draft');
});

test('interrupted share saves retain drafts and successful saves acknowledge only submitted content', async ({ page }) => {
  fixture(db => db.exec(`INSERT INTO ShareCollection(id,title,slug) VALUES('review-share','Saved review gallery','review-gallery'); INSERT INTO ShareCollectionItem(id,shareCollectionId,cardId) VALUES('review-item','review-share','ui-card-1');`));
  const url = '/shares/review-share/edit';
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /预览并保存/ }).click();
  await page.locator('input[name=title]').fill('Interrupted review draft');
  await page.route('**/shares/review-share/edit', route => route.request().method() === 'POST' ? route.abort() : route.continue());
  await page.getByRole('button', { name: '确认保存', exact: true }).first().click();
  await expect.poll(() => page.evaluate(() => Object.keys(localStorage).some(key => key.endsWith(':submitted') && localStorage.getItem(key).includes('token')))).toBe(true);
  await page.goto(url, { waitUntil: 'networkidle' });
  await expect(page.locator('.share-draft-recovery')).toBeVisible();
  await page.getByRole('button', { name: '恢复草稿', exact: true }).click();
  await page.getByRole('button', { name: /预览并保存/ }).click();
  await expect(page.locator('input[name=title]')).toHaveValue('Interrupted review draft');
  await page.unroute('**/shares/review-share/edit');
  await page.getByRole('button', { name: '确认保存', exact: true }).first().click();
  await expect(page).toHaveURL(/\/shares\?success=updated/);
  await expect.poll(() => page.evaluate(() => Object.keys(localStorage).some(key => key.startsWith('card-vault:share-editor:') && localStorage.getItem(key).includes('Interrupted review draft')))).toBe(false);
  await page.goto(url, { waitUntil: 'networkidle' });
  await expect(page.locator('.share-draft-recovery')).toHaveCount(0);
});

test('AI ignores late provider responses and confirms saves and custom deletion in English', async ({ page, context }) => {
  await context.addCookies([{name:'card_vault_ui_locale',value:'en',url:'http://127.0.0.1:3360'}]);
  await page.addInitScript(() => { window.cardVaultDesktop = {
    getAiSettings: async () => ({provider:'custom',activeCustomId:'local',azure:{endpoint:'https://azure.example.test',deployment:'vision',hasApiKey:true},minimax:{endpoint:'https://mini.example.test',model:'mini',hasApiKey:true},deepseek:{endpoint:'https://deep.example.test',model:'deepseek-chat',hasApiKey:true},customProviders:[{id:'local',name:'Local model',endpoint:'https://local.example.test/v1/chat/completions',model:'local',modelsEndpoint:'',hasApiKey:false,apiKeyHeader:'Authorization',apiKeyPrefix:'Bearer'}]}),
    saveAiSettings: async draft => ({...draft,customProviders:draft.customProviders.map(item=>({...item,hasApiKey:false}))})
  }; });
  let release, started;
  const gate = new Promise(resolve => { release = resolve; });
  const requested = new Promise(resolve => { started = resolve; });
  await page.route('**/api/ai/models', async route => { started(); await gate; await route.fulfill({json:{models:['local-only-model']}}).catch(()=>{}); });
  await page.goto('/settings', {waitUntil:'networkidle'});
  await page.locator('.ai-settings-panel > button').click();
  await page.getByRole('button',{name:'Load Models',exact:true}).click();
  await requested;
  await page.getByRole('combobox',{name:'Current Service',exact:true}).selectOption('deepseek');
  release();
  await expect(page.getByRole('button',{name:'Load Models',exact:true})).toBeEnabled();
  await expect(page.locator('.ai-settings-panel option', {hasText:'local-only-model'})).toHaveCount(0);
  await page.getByRole('button',{name:'Save Settings',exact:true}).click();
  await expect(page.getByRole('status')).toHaveText('AI settings saved.');
  await page.getByRole('button',{name:'Add Custom AI',exact:true}).click();
  await expect(page.getByLabel('Display Name *',{exact:true})).toHaveValue('Custom configuration 2');
  let promptMessage;
  page.once('dialog', async dialog => { promptMessage = dialog.message(); await dialog.dismiss(); });
  await page.getByRole('button',{name:'Delete Current Configuration',exact:true}).click();
  expect(promptMessage).toContain('Delete custom configuration');
});

test('large share groups render in batches and preserve selection and overrides across search', async ({ page }) => {
  fixture(db => {
    const insert = db.prepare("INSERT INTO Card(id,playerName,cardTitle,sport) VALUES(?,?,?,'ReviewSport')");
    for(let i=0;i<110;i++) insert.run(`review-batch-${i}`,`Review ${String(i).padStart(3,'0')}`,`Review batch card ${i}`);
  });
  await page.goto('/shares/new', {waitUntil:'networkidle'});
  await expect(page.locator('.share-card-option')).toHaveCount(0);
  const group = page.locator('.share-sport-group').filter({has:page.locator('summary > span',{hasText:'ReviewSport'})});
  await group.locator('summary').click();
  await expect(group.locator('.share-card-option')).toHaveCount(48);
  const first=group.locator('.share-card-option').first();
  await first.getByRole('checkbox').check();
  await first.locator('.share-card-overrides > summary').click();
  await first.getByLabel('展示标题',{exact:true}).fill('Retained display draft');
  await group.locator('.share-picker-more').click();
  await expect(group.locator('.share-card-option')).toHaveCount(96);
  await page.locator('.share-card-search input').fill('Review 000');
  await expect(page.locator('.share-card-option')).toHaveCount(1);
  await page.locator('.share-card-search input').fill('');
  await expect(first.getByRole('checkbox')).toBeChecked();
  await expect(first.locator('.share-card-overrides')).toHaveAttribute('open', '');
  await expect(first.getByLabel('展示标题',{exact:true})).toHaveValue('Retained display draft');
});
