const fs = require("node:fs");
const path = require("node:path");

function directoryBytes(root) {
  if (!fs.existsSync(root)) return 0n;
  const stat = fs.lstatSync(root);
  if (stat.isSymbolicLink()) throw new Error("数据目录包含符号链接，请先检查存储路径。");
  if (stat.isFile()) return BigInt(stat.size);
  return fs.readdirSync(root).reduce((total, name) => total + directoryBytes(path.join(root, name)), 0n);
}

function ensureFreeSpace(destination, bytes, statfs = fs.statfsSync) {
  let existing = path.resolve(destination);
  while (!fs.existsSync(existing)) {
    const parent = path.dirname(existing);
    if (parent === existing) throw new Error("无法读取目标磁盘空间。");
    existing = parent;
  }
  const stat = statfs(existing, { bigint: true });
  const available = BigInt(stat.bavail) * BigInt(stat.bsize);
  const payload = BigInt(bytes);
  const margin = payload / 10n > 64n * 1024n * 1024n ? payload / 10n : 64n * 1024n * 1024n;
  const required = payload + margin;
  if (available < required) throw new Error(`目标磁盘空间不足：预计需要 ${Number((required + 1048575n) / 1048576n)}MB，可用 ${Number(available / 1048576n)}MB。`);
  return { requiredBytes: required.toString(), availableBytes: available.toString() };
}

module.exports = { directoryBytes, ensureFreeSpace };
