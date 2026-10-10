const fs = require("node:fs");
const path = require("node:path");
const { writeJsonAtomic } = require("../../lib/atomic-json");
const { validateDatabase } = require("../../scripts/database-schema");
const { pathsEqual } = require("./file-utils");

function journalPath(target) { return path.join(path.dirname(target), `.${path.basename(target)}-restore-journal.json`); }
function validateJournal(target, journal) {
  const parent = path.dirname(target), base = path.basename(target);
  if (journal.version !== 1 || !pathsEqual(journal.target, target) || !/^\d+-\d+$/.test(journal.suffix) || !["prepared", "original-preserved", "switched", "verified"].includes(journal.stage)) throw new Error("恢复操作记录无效，未修改任何数据。请保留目录并检查日志。");
  for (const [key, kind] of [["staging", "staging"], ["rollback", "rollback"]]) {
    const expected = path.join(parent, `.${base}-restore-${kind}-${journal.suffix}`);
    if (typeof journal[key] !== "string" || !pathsEqual(journal[key], expected)) throw new Error("恢复操作记录路径无效，未修改任何数据。");
  }
}
function saveRestoreJournal(target, journal, stage) {
  const record = { ...journal, version: 1, target: path.resolve(target), stage };
  validateJournal(path.resolve(target), record);
  writeJsonAtomic(journalPath(path.resolve(target)), record);
  return record;
}
function clearRestoreJournal(target) { fs.rmSync(journalPath(path.resolve(target)), { force: true }); }

// A terminated process cannot run catch/finally. Recover before creating an empty data folder.
function recoverInterruptedRestore(targetPath) {
  const target = path.resolve(targetPath), file = journalPath(target);
  if (!fs.existsSync(file)) return null;
  const journal = JSON.parse(fs.readFileSync(file, "utf8"));
  validateJournal(target, journal);
  let verified = false;
  if (journal.stage === "verified" && fs.existsSync(path.join(target, "dev.db"))) {
    try { validateDatabase(path.join(target, "dev.db")); verified = true; } catch { /* Preserve and restore the original directory. */ }
  }
  const retained = [];
  if (verified) {
    if (fs.existsSync(journal.rollback)) {
      try { fs.rmSync(journal.rollback, { recursive: true, force: true }); } catch { retained.push(journal.rollback); }
    }
  } else if (fs.existsSync(journal.rollback)) {
    if (fs.existsSync(target)) {
      const interrupted = path.join(path.dirname(target), `.${path.basename(target)}-restore-interrupted-${journal.suffix}`);
      if (fs.existsSync(interrupted)) throw new Error("中断恢复的保留目录已存在，未覆盖任何数据。");
      fs.renameSync(target, interrupted); retained.push(interrupted);
    }
    fs.renameSync(journal.rollback, target);
  } else if (!fs.existsSync(target)) {
    throw new Error("恢复被中断且未找到原始数据目录，未创建空数据库。请使用安全备份恢复。");
  }
  if (fs.existsSync(journal.staging)) retained.push(journal.staging);
  clearRestoreJournal(target);
  return { recovered: true, keptVerifiedRestore: verified, retainedPaths: retained };
}
module.exports = { journalPath, saveRestoreJournal, clearRestoreJournal, recoverInterruptedRestore };
