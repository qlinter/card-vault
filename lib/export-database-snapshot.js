const { DatabaseSync, backup } = require('node:sqlite');

async function snapshotExportDatabase(sourcePath, targetPath, signal) {
  signal?.throwIfAborted();
  const source = new DatabaseSync(sourcePath, { readOnly: true });
  const started = Date.now();
  try {
    await backup(source, targetPath, { rate: 256, progress() {
      signal?.throwIfAborted();
      if (Date.now() - started > 30000) throw new Error('收藏数据持续变化，无法完成导出快照，请稍后重试。');
    } });
  } finally { source.close(); }
}
module.exports = { snapshotExportDatabase };
