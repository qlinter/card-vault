const fs = require("node:fs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");

// Keep the previous configuration intact until a complete replacement is ready.
function writeJsonAtomic(filePath, value) {
  const content = JSON.stringify(value, null, 2);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.${randomUUID()}.tmp`;
  try {
    fs.writeFileSync(temporaryPath, content, { flag: "wx", mode: 0o600, flush: true });
    fs.renameSync(temporaryPath, filePath);
  } finally {
    try { fs.rmSync(temporaryPath, { force: true }); } catch { /* Retain the original write error. */ }
  }
}

module.exports = { writeJsonAtomic };
