const fs = require("node:fs");
const path = require("node:path");

function createDesktopLogger(logsDir) {
  function ensureLogsDir() {
    fs.mkdirSync(logsDir, { recursive: true });
  }

  function appendLog(fileName, message) {
    ensureLogsDir();
    if (!message) return;
    fs.appendFileSync(path.join(logsDir, fileName), `${new Date().toISOString()} ${message}\n`);
  }

  return { ensureLogsDir, appendLog };
}

module.exports = { createDesktopLogger };
