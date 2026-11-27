const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { createLocalServerRuntime } = require('../electron/local-server-runtime');
const { createDesktopLogger } = require('../electron/desktop-logger');
test('preparation failures expose complete UTF-8 stderr and the actual log path', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'card-vault-startup-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const script = path.join(root, 'prepare-test.js');
  fs.writeFileSync(script, 'process.stderr.write("缺少数据表 CardTracking\\n", () => { process.exitCode = 1; });');
  const logger = createDesktopLogger(path.join(root, 'logs'));
  const runtime = createLocalServerRuntime({ app: { isPackaged: false }, rootDir: root, storage: { getEnv: () => ({}) }, aiConfig: { getConfigPath: () => '', getRuntimeEnv: () => ({}) }, logger });
  await assert.rejects(runtime.runNodeCommand(script, [], 'prepare.log'), error => {
    assert.match(error.message, /缺少数据表 CardTracking/);
    assert.match(error.message, /prepare-test.js exited with code 1/);
    assert.ok(error.message.includes(path.join(root, 'logs', 'prepare.log')));
    return true;
  });
  fs.writeFileSync(script, 'process.stderr.write("nonfatal warning");');
  await runtime.runNodeCommand(script, [], 'prepare.log');
});

test('an interrupted development build is prepared again before the server starts', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'card-vault-partial-build-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const healthRoute = path.join(root, '.next/server/app/api/health');
  fs.mkdirSync(healthRoute, { recursive: true });
  fs.writeFileSync(path.join(healthRoute, 'route.js'), '');
  fs.writeFileSync(path.join(root, '.next/BUILD_ID'), 'partial');
  const scripts = path.join(root, 'scripts');
  const prepare = path.join(scripts, 'prepare-local.js');
  fs.mkdirSync(scripts);
  fs.writeFileSync(prepare, "require('node:fs').writeFileSync('.next/server/preview-props.json', '{}');");
  const runtime = createLocalServerRuntime({
    app: { isPackaged: false }, rootDir: root, storage: { getEnv: () => ({}) },
    aiConfig: { getConfigPath: () => path.join(root, 'ai-config.json'), getRuntimeEnv: () => ({}) },
    logger: createDesktopLogger(path.join(root, 'logs'))
  });
  await runtime.ensurePreparedBuild();
  assert.ok(fs.existsSync(path.join(root, '.next/server/preview-props.json')));
  fs.writeFileSync(prepare, 'process.exitCode = 1;');
  await runtime.ensurePreparedBuild();
});
