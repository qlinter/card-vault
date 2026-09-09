const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { writeJsonAtomic } = require('../lib/atomic-json');
const { pathsEqual, isSubPath } = require('../electron/storage/file-utils');

test('atomic configuration replacement preserves the original after write or rename failure', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'card-vault-atomic-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const file = path.join(root, 'config.json');
  writeJsonAtomic(file, { dataDir: 'original' });
  const original = fs.readFileSync(file);
  for (const operation of ['writeFileSync', 'renameSync']) {
    const fault = t.mock.method(fs, operation, () => { throw new Error('simulated full disk'); });
    assert.throws(() => writeJsonAtomic(file, { dataDir: 'replacement' }), /simulated full disk/);
    fault.mock.restore();
    assert.deepEqual(fs.readFileSync(file), original);
    assert.deepEqual(fs.readdirSync(root), ['config.json']);
  }
  writeJsonAtomic(file, { dataDir: 'replacement' });
  assert.deepEqual(JSON.parse(fs.readFileSync(file)), { dataDir: 'replacement' });
});

test('path containment includes dot-prefixed child directories but excludes siblings', () => {
  const root = path.resolve('test-root');
  assert.equal(isSubPath(root, path.join(root, '..photos')), true);
  assert.equal(isSubPath(root, path.join(root, '..', 'other')), false);
  assert.equal(isSubPath(root, root), false);
  assert.equal(pathsEqual(root, path.join(root, '.')), true);
  if (process.platform === 'win32') assert.equal(pathsEqual(root, root.toUpperCase()), true);
});
