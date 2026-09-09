const fs = require("node:fs");
const path = require("node:path");

function createDesktopLogger(logsDir, { maxBytes = 2 * 1024 * 1024 } = {}) {
  function ensureLogsDir() {
    try { fs.mkdirSync(logsDir, { recursive: true }); return true; } catch { return false; }
  }

  function appendLog(fileName, message) {
    if (!message || !ensureLogsDir()) return false;
    try {
      const target = path.join(logsDir, path.basename(fileName));
      if (fs.existsSync(target) && fs.statSync(target).size >= maxBytes) {
        fs.rmSync(`${target}.previous`, { force: true });
        fs.renameSync(target, `${target}.previous`);
      }
      fs.appendFileSync(target, `${new Date().toISOString()} ${String(message).slice(0, maxBytes)}\n`);
      return true;
    } catch { return false; }
  }

  return { ensureLogsDir, appendLog, getLogPath: (fileName) => path.join(logsDir, path.basename(fileName)) };
}

module.exports = { createDesktopLogger };
