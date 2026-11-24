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

test.beforeEach(async () => {
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
test.afterEach(async () => { flows.stopServer(server); if (root) await flows.removeTempRoot(root); });

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

test('guest mode shows public exhibits and blocks owner pages, data, and media', async ({ page, context }) => {
  test.setTimeout(90000);
  const data = path.join(root, 'data');
  const db = new DatabaseSync(path.join(data, 'dev.db'));
  try {
    db.prepare("INSERT INTO Card(id,playerName,cardTitle,sport,visibility,publicDescription,notes,tags,collectionStatus) VALUES ('guest-public','Ada Guest Fixture','Public exhibit','Basketball','public','Gallery description','Private notes sentinel','Hidden tag sentinel','sold'), ('guest-link','By Link Fixture','Unlisted exhibit','Basketball','linkOnly',NULL,NULL,NULL,'holding')").run();
    db.prepare("INSERT INTO CardTransaction(id,cardId,kind,amountMinor,currency,quantity,occurredAt,notes,provenance) VALUES('guest-sale','guest-public','sale',918273645,'CNY',1,'2026-11-01','Financial notes sentinel','test')").run();
    const uploads = path.join(data, 'uploads');
    fs.mkdirSync(uploads, { recursive: true });
    for (const [id, file] of [['guest-public','public.webp'], ['auth-private','private.webp'], ['guest-link','unlisted.webp']]) {
      fs.copyFileSync('tests/fixtures/ui-media/showcase-bg.webp', path.join(uploads, file));
      db.prepare('INSERT INTO CardImage(id,cardId,path) VALUES(?,?,?)').run(id, id, '/media/' + file);
    }
  } finally { db.close(); }
  const post = (action, values = {}) => page.request.post(origin + '/api/account', { headers: { Origin: origin }, data: { action, ...values } });
  const get = route => page.request.get(origin + route);
  await page.goto(origin + '/login');
  await expect(page.getByRole('button', { name: '访客浏览', exact: true })).toHaveCount(0);
  expect((await post('setup', { username: 'Collector', password })).status()).toBe(200);
  expect((await post('confirm-recovery', { acknowledged: true })).status()).toBe(200);
  async function checkShowcaseLayout(view) {
    for (const width of [320, 390, 700, 1440]) {
      await view.setViewportSize({ width, height: 760 });
      const browse = await view.getByRole('button', { name: /^(浏览|Browse)$/ }).boundingBox();
      const heading = await view.locator('.showcase-heading').boundingBox();
      const header = await view.locator('.topbar-inner').boundingBox();
      const language = await view.locator('.language-switch').boundingBox();
      expect(browse.x).toBeCloseTo(heading.x, 0);
      // Measure the visible labels. Matching button and heading boxes can hide different text insets.
      const textLeft = element => {
        const text = [...element.childNodes].find(node => node.nodeType === Node.TEXT_NODE && node.textContent.trim());
        const range = document.createRange();
        range.selectNodeContents(text);
        return range.getBoundingClientRect().left;
      };
      const browseLabel = await view.locator('button.showcase-action').evaluate(textLeft);
      const select = view.locator('.showcase-group-select');
      const groupLabel = await select.isVisible() ? await select.evaluate(element => {
        const style = getComputedStyle(element);
        return element.getBoundingClientRect().left + parseFloat(style.borderLeftWidth) + parseFloat(style.paddingLeft);
      }) : await view.locator('.showcase-chip').first().evaluate(textLeft);
      expect(browseLabel).toBeCloseTo(groupLabel, 0);
      expect(browseLabel).toBeCloseTo(await view.locator('.showcase-current-group').evaluate(textLeft), 0);
      expect(language.x + language.width).toBeCloseTo(header.x + header.width, 0);
      expect(await view.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
  }
  await page.goto(origin + '/showcase');
  await checkShowcaseLayout(page);
  await page.goto(origin + '/portfolio');
  const other = await context.newPage();
  await other.goto(origin + '/portfolio');
  await other.goto(origin + '/settings');
  await other.getByRole('button', { name: '展开账户与安全' }).click();
  const allow = other.getByLabel('允许访客浏览');
  await expect(allow).not.toBeChecked();
  expect((await post('start-guest')).status()).toBe(403);
  await allow.check();
  await expect(other.getByText('访客可查看 1 张公开卡牌')).toBeVisible();
  const oldOwner = (await context.cookies()).find(cookie => cookie.name === 'card-vault-account');
  await other.getByRole('button', { name: '进入访客浏览' }).click();
  await expect(other).toHaveURL(origin + '/showcase');
  await expect(page).toHaveURL(origin + '/showcase');
  await expect(other.locator('.guest-mode-label')).toHaveText('访客浏览');
  await expect(other.locator('.showcase-card')).toHaveCount(1);
  await expect(other.getByRole('link', { name: '分享集', exact: true })).toHaveCount(0);
  await expect(other.locator('.guest-topbar').getByRole('link')).toHaveCount(1);
  await checkShowcaseLayout(other);
  await other.getByRole('button', { name: '选择语言' }).click();
  await other.getByRole('menuitemradio', { name: 'English' }).click();
  await expect(other.locator('.guest-mode-label')).toHaveText('Guest browsing');
  await checkShowcaseLayout(other);
  await other.getByRole('button', { name: 'Choose language' }).click();
  await other.getByRole('menuitemradio', { name: '简体中文' }).click();
  await other.goBack();
  await expect(other).toHaveURL(origin + '/showcase');
  await expect(other.locator('.guest-mode-label')).toBeVisible();
  await page.goto(origin + '/portfolio');
  await expect(page).toHaveURL(origin + '/showcase');
  const guestCookie = (await context.cookies()).find(cookie => cookie.name === 'card-vault-guest');
  expect(guestCookie.httpOnly).toBe(true);
  expect(guestCookie.sameSite).toBe('Strict');
  const guestStatus = await get('/api/account').then(response => response.json());
  expect(guestStatus).toMatchObject({ authenticated: false, guest: true });
  expect(guestStatus).not.toHaveProperty('username');

  for (const route of ['/cards/guest-public', '/portfolio', '/settings', '/api/cards', '/api/data-center?export=csv', '/api/collection-recaps', '/api/cards/guest-public/images/export', '/share-covers/public.webp']) {
    expect((await get(route)).status(), route).toBe(403);
  }
  expect((await post('set-guest', { enabled: false })).status()).toBe(401);
  expect((await page.request.post(origin + '/showcase', { headers: { Origin: origin }, data: {} })).status()).toBe(403);
  const replayOwner = await page.request.get(origin + '/api/cards', { headers: { Cookie: oldOwner.name + '=' + oldOwner.value } });
  expect(replayOwner.status()).toBe(401);

  for (const [id, file] of [['auth-private','private.webp'], ['guest-link','unlisted.webp']]) {
    for (const route of ['/showcase/cards/' + id, '/api/immersive?id=' + id, '/media/' + file, '/thumbnails/' + file + '.home.webp']) {
      expect((await get(route)).status(), route).toBe(404);
    }
  }
  for (const route of ['/media/public.webp', '/thumbnails/public.webp.home.webp']) {
    const response = await get(route);
    expect(response.status(), route).toBe(200);
    expect(response.headers()['cache-control']).toContain('no-store');
  }
  expect(await get('/api/immersive').then(response => response.json())).toEqual({ ids: ['guest-public'], nextCursor: null });
  expect((await get('/api/immersive?excludeSold=1')).status()).toBe(403);
  expect((await get('/api/immersive?spec={}')).status()).toBe(403);
  const galleryCard = await get('/api/immersive?id=guest-public').then(response => response.json());
  expect(galleryCard.card).not.toHaveProperty('collectionStatus');
  await other.getByRole('button', { name: '浏览', exact: true }).click();
  await expect(other.locator('.immersive-stage')).toHaveAttribute('data-card-id', 'guest-public');
  await other.getByRole('button', { name: '展馆设置', exact: true }).click();
  await expect(other.getByLabel('排除已售')).toHaveCount(0);
  await other.keyboard.press('Escape');
  await expect(other.locator('#gallery-settings')).toBeHidden();
  await other.getByRole('button', { name: '退出赏卡' }).click();
  await other.locator('.showcase-card').click();
  await expect(other.getByText('Gallery description')).toBeVisible();
  await expect(other.getByText('Private notes sentinel')).toHaveCount(0);
  const detail = await get('/showcase/cards/guest-public').then(response => response.text());
  expect(detail).not.toMatch(/918273645|Financial notes sentinel|Private notes sentinel/);
  await expect(other.getByRole('button', { name: '导出图片' })).toHaveCount(0);
  await other.goto(origin + '/showcase?q=Hidden+tag+sentinel');
  await expect(other.locator('.showcase-card')).toHaveCount(0);
  const visibilityDb = new DatabaseSync(path.join(data, 'dev.db'));
  try {
    visibilityDb.prepare("UPDATE Card SET visibility='private' WHERE id='guest-public'").run();
    expect((await get('/media/public.webp')).status()).toBe(404);
    expect((await get('/thumbnails/public.webp.home.webp')).status()).toBe(404);
    expect((await get('/showcase/cards/guest-public')).status()).toBe(404);
  } finally {
    visibilityDb.prepare("UPDATE Card SET visibility='public' WHERE id='guest-public'").run();
    visibilityDb.close();
  }
  await other.getByRole('button', { name: '退出访客' }).click();
  await expect(other).toHaveURL(origin + '/login');
  const replayGuest = await page.request.get(origin + '/media/public.webp', { headers: { Cookie: guestCookie.name + '=' + guestCookie.value } });
  expect(replayGuest.status()).toBe(401);
  const guestEntry = other.locator('.account-gateway-tools').getByRole('button', { name: '访客浏览', exact: true });
  await expect(guestEntry).toBeVisible();
  await other.setViewportSize({ width: 320, height: 760 });
  const entryBox = await guestEntry.boundingBox();
  const languageBox = await other.locator('.language-switch').boundingBox();
  expect(entryBox.x + entryBox.width).toBeLessThanOrEqual(languageBox.x);
  expect(entryBox.y + entryBox.height).toBeLessThan((await other.locator('.account-card').boundingBox()).y);
  await other.screenshot({ path: 'logs/guest-entry-login.png' });
  await guestEntry.click();
  await expect(other).toHaveURL(origin + '/showcase');
  await other.reload();
  await expect(other.locator('.guest-mode-label')).toBeVisible();
  await other.setViewportSize({ width: 320, height: 760 });
  expect(await other.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await other.screenshot({ path: 'logs/guest-showcase.png', fullPage: true });
  await other.getByRole('button', { name: '退出访客' }).click();
  await expect(other).toHaveURL(origin + '/login');
  await signIn(other);
  await other.goto(origin + '/settings');
  await other.getByRole('button', { name: '展开账户与安全' }).click();
  await other.getByLabel('允许访客浏览').uncheck();
  await expect(other.getByLabel('允许访客浏览')).toBeEnabled();
  await expect(other.getByRole('button', { name: '进入访客浏览' })).toHaveCount(0);
  await other.getByRole('button', { name: '退出登录' }).click();
  await expect(other).toHaveURL(origin + '/login');
  await expect(other.getByRole('button', { name: '访客浏览', exact: true })).toHaveCount(0);
});
