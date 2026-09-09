const fs = require("node:fs");
const { pipeline } = require("node:stream/promises");
const archiver = require("archiver");

// Entries carry paths or small metadata strings, never a whole export buffer.
async function writeStreamingZip(output, entries, signal) {
  signal?.throwIfAborted();
  const zip = archiver("zip", { zlib: { level: 6 } });
  zip.on("warning", error => zip.destroy(error));
  const destination = fs.createWriteStream(output, { flags: "wx", mode: 0o600 });
  let created = false;
  destination.once("open", () => { created = true; });
  const done = pipeline(zip, destination, { signal });
  // Handle early disk errors while archive entries are still being registered.
  void done.catch(() => {});
  try {
    for (const entry of entries) {
      if (entry.path !== undefined) zip.file(entry.path, { name: entry.name });
      else zip.append(entry.content, { name: entry.name });
    }
    await Promise.all([zip.finalize(), done]);
  } catch (error) {
    zip.abort();
    zip.destroy();
    await done.catch(() => {});
    // Never remove an existing file when exclusive creation failed.
    if (created) await fs.promises.rm(output, { force: true }).catch(() => {});
    throw error;
  }
}

module.exports = { writeStreamingZip };
