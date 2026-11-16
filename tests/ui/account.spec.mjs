import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import flows from '../../scripts/test-http-flow-utils.js';

test.use({ storageState: { cookies: [], origins: [] } });
let root, server, origin, output;
const password = 'Local123';
const nextPassword = '😀'.repeat(128);

test.beforeAll(async () => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'card-vault-account-ui-'));
  const data = path.join(root, 'data'), dbPath = path.join(data, 'dev.db');
  const env = { ...process.env, CARD_VAULT_DATA_DIR: data, DATABASE_URL: flows.fileDatabaseUrl(dbPath) };
  flows.initializeTestDatabase(env);
  const db = new DatabaseSync(dbPath);
  db.prepare("INSERT INTO Card(id,playerName,cardTitle,sport,visibility) VALUES('auth-private','Private Account Fixture','Confidential card','Basketball','private')").run();
  db.close();
  const port = await flows.findAvailablePort(3450); origin = `http://127.0.0.1:${port}`; output = [];
  server = flows.startTestServer(port, env, output);
  await expect.poll(async () => {
    if (server.exitCode !== null) throw new Error(output.join(''));
    try { return (await fetch(origin + '/api/health')).status; } catch { return 0; }
  }, { timeout: 30000 }).toBe(200);
});
test.afterAll(async () => { flows.stopServer(server); if (root) await flows.removeTempRoot(root); });

async function signIn(page, pass = password, name = 'Collector') {
  await page.locator('#account-username').fill(name);
  await page.locator('#account-password').fill(pass);
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await expect(page.locator('.topbar')).toBeVisible();
}

test('setup, privacy gate, refresh, sign-out, account changes and one-use recovery work end to end', async ({ page }) => {
  test.setTimeout(120000);
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto(origin);
  await expect(page).toHaveURL(origin + '/login');
  await expect(page.getByRole('heading', { name: '创建本地账户' })).toBeVisible();
  await expect(page.locator('.topbar')).toHaveCount(0);
  expect(await page.content()).not.toContain('Private Account Fixture');
  for (const route of ['/api/cards', '/api/ai/settings', '/media/private.webp', '/thumbnails/private.webp', '/share-covers/private.webp', '/share-backgrounds/private.webp', '/api/collection-recaps/export']) {
    expect((await page.request.get(origin + route)).status()).toBe(401);
  }
  expect((await page.request.post(origin + '/api/account', { data: { action: 'setup', username: 'Collector', password } })).status()).toBe(403);
  for (const english of [true, false]) {
    await page.getByRole('button', { name: /^(选择语言|Choose language)$/ }).click();
    await page.getByRole('menuitemradio', { name: english ? 'English' : '简体中文' }).click();
    await expect(page.locator('.account-card .account-hint')).toHaveCount(0);
    await page.locator('#account-username').fill('Collector');
    await page.locator('#confirm-password').fill(password);
    for (const value of ['a'.repeat(7), 'a'.repeat(129), '😀'.repeat(7), '😀'.repeat(129)]) {
      const field = page.locator('#account-password');
      await field.fill(value);
      await expect(field).toHaveValue(value);
      await page.getByRole('button', { name: english ? 'Create account' : '创建账户', exact: true }).click();
      expect(await field.evaluate(input => input.validationMessage)).toBe(english ? 'Use 8–128 characters for the password.' : '密码需为 8–128 个字符。');
      await expect(field).toBeFocused();
      expect((await page.request.get(origin + '/api/account').then(response => response.json())).state).toBe('setup');
    }
  }
  await page.locator('#account-username').fill('Collector');
  await page.locator('#account-password').fill(password);
  expect(await page.locator('#account-password').evaluate(input => input.checkValidity())).toBe(true);
  await page.locator('#confirm-password').fill(password);
  await page.getByRole('button', { name: '显示密码', exact: true }).first().click();
  await expect(page.locator('#account-password')).toHaveAttribute('type', 'text');
  await expect(page.locator('.account-reveal').first()).toHaveText('');
  await expect(page.locator('.account-reveal').first().locator('svg')).toHaveCount(1);
  await page.getByRole('button', { name: '创建账户', exact: true }).click();
  let initialCode = await page.locator('.account-recovery-code').innerText();
  await expect(page.getByRole('button', { name: '继续', exact: true })).toBeDisabled();
  expect((await page.request.get(origin + '/api/cards')).status()).toBe(401);
  await expect(page.getByRole('button', { name: /^(复制|Copy|已复制|Copied)$/ })).toHaveCount(0);
  await page.getByLabel('我已妥善保存恢复码').check();
  await page.getByRole('button', { name: '继续', exact: true }).click();
  await expect(page.getByText('Private Account Fixture', { exact: true }).first()).toBeVisible();
  const validCookie = (await page.context().cookies()).find(cookie => cookie.name === 'card-vault-account');
  expect(validCookie.httpOnly).toBe(true); expect(validCookie.sameSite).toBe('Strict');
  await page.reload();
  await expect(page.locator('.topbar')).toBeVisible();
  const protectedHtml = await page.request.get(origin + '/cards/new').then(response => response.text());
  expect(protectedHtml).toContain('$ACTION_');
  await page.goto(origin + '/cards/new');
  let interruptSignOut = true;
  await page.route('**/api/account', route => {
    if (route.request().method() === 'POST' && route.request().postDataJSON().action === 'logout' && interruptSignOut) {
      interruptSignOut = false; return route.abort();
    }
    return route.continue();
  });
  await expect(page.locator('.header-utilities .header-tool')).toHaveCount(2);
  await page.getByRole('link', { name: '设置', exact: true }).click();
  await expect(page.getByRole('button', { name: '展开账户与安全', exact: true })).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByRole('button', { name: '锁定', exact: true })).toHaveCount(0);
  await expect(page.locator('.settings-footer-bar').getByRole('button', { name: '退出登录', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '退出登录', exact: true }).click();
  await expect(page.locator('.account-lock-cover')).toBeVisible();
  await expect(page.locator('.account-lock-cover')).toContainText('连接中断');
  await expect(page.locator('.topbar')).toBeHidden();
  await page.getByRole('button', { name: '返回登录', exact: true }).click();
  await expect(page).toHaveURL(origin + '/login');
  await expect(page.locator('.topbar')).toHaveCount(0);
  await page.context().addCookies([validCookie]);
  expect((await page.request.get(origin + '/api/cards')).status()).toBe(401);
  // A captured server action submitted to the public login page must still
  // authenticate at the action itself, independently of the proxy route gate.
  const marker = protectedHtml.indexOf('name="playerName"');
  const formHtml = protectedHtml.slice(protectedHtml.lastIndexOf('<form', marker), protectedHtml.indexOf('</form>', marker));
  const actionFields = [...formHtml.matchAll(/<input type="hidden" name="(\$ACTION_[^"]+)"(?: value="([^"]*)")?\/>/g)].map(match => [match[1], flows.decodeHtmlAttribute(match[2])]);
  expect(actionFields.length).toBeGreaterThan(0);
  await page.evaluate(async fields => {
    const form = new FormData(); for (const [name, value] of fields) form.append(name, value);
    form.append('playerName', 'Anonymous Action Must Not Save');
    await fetch('/login', { method: 'POST', body: form });
  }, actionFields);
  const guardedDb = new DatabaseSync(path.join(root, 'data', 'dev.db'));
  try { expect(guardedDb.prepare('SELECT COUNT(*) AS n FROM Card').get().n).toBe(1); } finally { guardedDb.close(); }
  await page.goBack();
  await expect(page).toHaveURL(origin + '/login');
  for (const english of [true, false]) {
    await page.getByRole('button', { name: /^(选择语言|Choose language)$/ }).click();
    await page.getByRole('menuitemradio', { name: english ? 'English' : '简体中文' }).click();
    await page.locator('#account-username').fill('Collector');
    await page.locator('#account-password').fill('wrong password');
    await page.getByRole('button', { name: english ? 'Sign in' : '登录', exact: true }).click();
    await expect(page.locator('#account-error')).toHaveText(english ? 'The username or password is incorrect.' : '用户名或密码不正确。');
  }
  await page.getByRole('button', { name: '忘记密码', exact: true }).click();
  await expect(page.locator('#recovery-code')).toHaveValue('');
  await page.locator('#recovery-code').fill('a recovery code must never become a username');
  await page.getByRole('button', { name: '返回登录', exact: true }).click();
  await expect(page.locator('#account-username')).toHaveValue('');
  await signIn(page);
  await page.goto(origin + '/settings');
  await expect(page.getByRole('button', { name: '展开账户与安全', exact: true })).toHaveAttribute('aria-expanded', 'false');
  await page.goto(origin + '/settings#account-security');
  await expect(page.getByRole('button', { name: '展开账户与安全', exact: true })).toHaveAttribute('aria-expanded', 'false');
  await page.getByRole('button', { name: '展开账户与安全', exact: true }).click();
  await page.locator('#account-current-password').fill('wrong password');
  await page.locator('#account-new-username').fill('New Collector');
  await page.getByRole('button', { name: '确认修改', exact: true }).click();
  await expect(page.locator('.account-settings .account-error')).toHaveText('当前密码不正确。');
  await page.locator('#account-current-password').fill(password);
  await page.locator('#account-new-username').fill('New Collector');
  await page.getByRole('button', { name: '确认修改', exact: true }).click();
  await expect(page.locator('.account-current strong')).toHaveText('New Collector');
  await page.locator('#account-change').selectOption('rotate-recovery');
  await expect(page.locator('.account-settings .account-form .account-hint')).toHaveCount(0);
  await page.locator('#account-current-password').fill(password);
  await page.getByRole('button', { name: '确认修改', exact: true }).click();
  const rotatedCode = await page.locator('.account-recovery-code').innerText();
  expect(rotatedCode).not.toBe(initialCode);
  await expect(page.locator('.topbar')).toHaveCount(0);
  await expect(page.locator('.settings-page')).toHaveCount(0);
  // A replacement code survives the session check and window focus while
  // collection access stays unavailable until the new code is acknowledged.
  await page.waitForTimeout(16000);
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  expect(await page.evaluate(() => fetch('/api/cards').then(response => response.status))).toBe(401);
  await expect(page.locator('.account-recovery-code')).toBeVisible();
  await expect(page.locator('.account-recovery-code')).toHaveText(rotatedCode);
  await page.getByLabel('我已妥善保存恢复码').check();
  await page.getByRole('button', { name: '继续', exact: true }).click();
  await expect(page).toHaveURL(origin + '/login');
  initialCode = rotatedCode;
  await signIn(page, password, 'New Collector');
  await page.goto(origin + '/settings');
  await page.getByRole('button', { name: '展开账户与安全', exact: true }).click();
  await page.locator('#account-change').selectOption('change-password');
  await expect(page.locator('.account-settings .account-form .account-hint')).toHaveCount(0);
  await page.locator('#account-current-password').fill(password);
  await page.locator('#account-confirm-password').fill(nextPassword);
  await page.locator('#account-new-password').fill('short');
  await page.getByRole('button', { name: '确认修改', exact: true }).click();
  expect(await page.locator('#account-new-password').evaluate(input => input.validationMessage)).toBe('密码需为 8–128 个字符。');
  await page.locator('#account-new-password').fill(nextPassword);
  await page.getByRole('button', { name: '确认修改', exact: true }).click();
  await expect(page).toHaveURL(origin + '/login');
  await signIn(page, nextPassword, 'New Collector');
  await page.getByRole('link', { name: '设置', exact: true }).click();
  await page.getByRole('button', { name: '退出登录', exact: true }).click();
  await page.getByRole('button', { name: '忘记密码', exact: true }).click();
  for (const english of [true, false]) {
    await page.getByRole('button', { name: /^(选择语言|Choose language)$/ }).click();
    await page.getByRole('menuitemradio', { name: english ? 'English' : '简体中文' }).click();
    await page.locator('#recovery-code').fill('wrong recovery code');
    await page.locator('#account-password').fill(password);
    await page.locator('#confirm-password').fill(password);
    await page.getByRole('button', { name: english ? 'Reset password' : '重设密码', exact: true }).click();
    await expect(page.locator('#account-error')).toHaveText(english ? 'The recovery code is incorrect.' : '恢复码不正确。');
  }
  await page.locator('#recovery-code').fill(initialCode);
  await page.locator('#account-password').fill(password);
  await page.locator('#confirm-password').fill(password);
  await page.getByRole('button', { name: '重设密码', exact: true }).click();
  const nextCode = await page.locator('.account-recovery-code').innerText();
  expect(nextCode).not.toBe(initialCode);
  await expect(page.locator('.account-current strong')).toHaveText('New Collector');
  await page.getByLabel('我已妥善保存恢复码').check();
  await page.getByRole('button', { name: '继续', exact: true }).click();
  await expect(page).toHaveURL(origin + '/login');
  const reused = await page.request.post(origin + '/api/account', { headers: { Origin: origin }, data: { action: 'recover', recoveryCode: initialCode, password } });
  expect(reused.status()).toBe(401);
  await signIn(page, password, 'New Collector');
  await page.addInitScript(() => {
    window.BroadcastChannel = class { constructor() { throw new DOMException('Messaging unavailable', 'SecurityError'); } };
  });
  await page.reload();
  await expect(page.locator('.topbar')).toBeVisible();
  await page.getByRole('link', { name: '设置', exact: true }).click();
  await page.getByRole('button', { name: '退出登录', exact: true }).click();
  await expect(page).toHaveURL(origin + '/login');
  expect(errors).toEqual([]);
});

test('login follows four app themes, both languages and small screens without overflow', async ({ page, context }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  const state = await page.request.get(origin + '/api/account').then(response => response.json());
  if (state.state === 'setup') {
    const created = await page.request.post(origin + '/api/account', { headers: { Origin: origin }, data: { action: 'setup', username: 'Collector', password } });
    expect(created.ok()).toBe(true);
  }
  for (const theme of ['classic', 'gallery', 'midnight', 'archive']) {
    for (const locale of ['zh', 'en']) {
      await context.addCookies([{ name: 'card_vault_app_theme', value: theme, url: origin }, { name: 'card_vault_ui_locale', value: locale, url: origin }]);
      await page.goto(origin + '/login');
      await expect(page.getByRole('heading', { name: locale === 'zh' ? '登录' : 'Sign in', exact: true })).toBeVisible();
      const toggle = page.locator('.account-reveal');
      await expect(toggle).toHaveText('');
      await expect(toggle.locator('svg')).toHaveCount(1);
      await toggle.click();
      await expect(page.locator('#account-password')).toHaveAttribute('type', 'text');
      await expect(toggle).toHaveAccessibleName(locale === 'zh' ? '隐藏密码' : 'Hide password');
      await toggle.click();
      await expect(page.locator('#account-password')).toHaveAttribute('type', 'password');
      for (const width of [1440, 390, 320]) {
        await page.setViewportSize({ width, height: 900 });
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        const size = await page.locator('#account-password').evaluate(element => element.getBoundingClientRect().height);
        expect(size).toBe(40);
      }
      await page.screenshot({ path: `logs/account-login-${theme}-${locale}.png`, fullPage: true });
    }
  }
  expect(errors).toEqual([]);
});
