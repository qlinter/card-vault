const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

test('database preparation failure preserves the previous build and skips compilation', { skip: process.platform !== 'win32' }, t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'card-vault-preparation-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'scripts'));
  fs.mkdirSync(path.join(root, '.next'));
  fs.writeFileSync(path.join(root, '.next', 'BUILD_ID'), 'previous-build');
  fs.copyFileSync(path.join(__dirname, '../scripts/prepare-local.js'), path.join(root, 'scripts', 'prepare-local.js'));
  fs.writeFileSync(path.join(root, 'scripts', 'storage-paths.js'), `module.exports = Object.fromEntries(['resolveShareBackgroundsDir','resolveShareCoversDir','resolveThumbnailsDir','resolveUploadsDir'].map(name => [name, root => require('node:path').join(root,'data',name)]));`);
  fs.writeFileSync(path.join(root, 'scripts', 'init-db.js'), 'process.stderr.write("Invalid database fixture"); process.exitCode=1;');
  const result = spawnSync(process.execPath, [path.join(root, 'scripts', 'prepare-local.js')], { cwd: root, encoding: 'utf8', windowsHide: true, timeout: 15000 });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Invalid database fixture/);
  assert.equal(fs.readFileSync(path.join(root, '.next', 'BUILD_ID'), 'utf8'), 'previous-build');
  assert.doesNotMatch(result.stdout, /Building app|Generating Prisma/);
});
