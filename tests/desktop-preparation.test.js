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
