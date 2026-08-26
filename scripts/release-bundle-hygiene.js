const fs = require("node:fs");
const path = require("node:path");

const mebibyte = 1024 * 1024;
const defaultArtifactLimits = Object.freeze({
  installer: 220 * mebibyte,
  portable: 280 * mebibyte
});

function normalizePackagedEntry(value) {
  return String(value).replace(/\\/g, "/");
}

function isForbiddenPackagedEntry(value) {
  const normalized = normalizePackagedEntry(value).toLowerCase();
  if (!normalized.startsWith("resources/app/")) return false;
  return normalized.endsWith(".map")
    || (normalized.includes("/node_modules/.prisma/client/") && /\.tmp[^/]*$/.test(normalized));
}

function assertInside(parent, target) {
  const resolvedParent = path.resolve(parent);
  const resolvedTarget = path.resolve(target);
  if (resolvedTarget !== resolvedParent && !resolvedTarget.startsWith(resolvedParent + path.sep)) {
    throw new Error(`Refusing release cleanup outside ${resolvedParent}: ${resolvedTarget}`);
  }
  return resolvedTarget;
}

function prunePrismaTempEngines(prismaClientDir) {
  const resolvedRoot = path.resolve(prismaClientDir);
  if (!fs.existsSync(resolvedRoot)) return [];
  const removed = [];
  for (const entry of fs.readdirSync(resolvedRoot, { withFileTypes: true })) {
    if (!entry.isFile() || !/\.tmp[^/]*$/i.test(entry.name)) continue;
    const target = assertInside(resolvedRoot, path.join(resolvedRoot, entry.name));
    fs.rmSync(target, { force: true });
    removed.push(target);
  }
  return removed;
}

function listPackagedFiles(rootDir) {
  if (!fs.existsSync(rootDir)) return [];
  const files = [];
  const pending = [path.resolve(rootDir)];
  while (pending.length > 0) {
    const current = pending.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const target = path.join(current, entry.name);
      if (entry.isDirectory()) pending.push(target);
      else if (entry.isFile()) files.push(path.relative(rootDir, target));
    }
  }
  return files;
}

function assertPackagedTreeClean(appRoot) {
  const forbidden = listPackagedFiles(appRoot).filter((entry) => isForbiddenPackagedEntry(`resources/app/${entry}`));
  if (forbidden.length > 0) {
    throw new Error(`Release bundle contains forbidden generated files: ${forbidden.slice(0, 8).join(", ")}`);
  }
}

function assertArtifactSize(filePath, maximumBytes, label) {
  const size = fs.statSync(filePath).size;
  if (size > maximumBytes) {
    throw new Error(`${label} is ${(size / mebibyte).toFixed(1)} MiB, above the ${(maximumBytes / mebibyte).toFixed(1)} MiB release budget.`);
  }
  return size;
}

module.exports = {
  assertArtifactSize,
  assertPackagedTreeClean,
  defaultArtifactLimits,
  isForbiddenPackagedEntry,
  normalizePackagedEntry,
  prunePrismaTempEngines
};
