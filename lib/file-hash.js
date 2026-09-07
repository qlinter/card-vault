const fs = require("node:fs");
const { createHash } = require("node:crypto");

// Bound memory use for both collection media and large distribution archives.
function sha256File(filePath) {
  const hash = createHash("sha256");
  const buffer = Buffer.alloc(1024 * 1024);
  const fd = fs.openSync(filePath, "r");
  try {
    let bytes;
    while ((bytes = fs.readSync(fd, buffer, 0, buffer.length, null))) hash.update(buffer.subarray(0, bytes));
  } finally {
    fs.closeSync(fd);
  }
  return hash.digest("hex");
}

module.exports = { sha256File };
