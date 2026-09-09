const fs = require("node:fs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { writeJsonAtomic } = require("../lib/atomic-json");

function createMemorySampler(directory, intervalMs = 250) {
  const samplePath = path.join(directory, "memory.json");
  const resetPath = path.join(directory, "memory-reset.json");
  writeJsonAtomic(resetPath, { token: randomUUID() });
  const read = () => JSON.parse(fs.readFileSync(samplePath, "utf8"));
  return {
    env: {
      NODE_OPTIONS: `${process.env.NODE_OPTIONS || ""} --require "${__filename.replaceAll("\\", "/")}"`.trim(),
      CARD_VAULT_TEST_MEMORY_PATH: samplePath,
      CARD_VAULT_TEST_MEMORY_RESET: resetPath,
      CARD_VAULT_TEST_MEMORY_INTERVAL: String(intervalMs)
    },
    read,
    async reset() {
      const token = randomUUID();
      writeJsonAtomic(resetPath, { token });
      const deadline = Date.now() + 5000;
      while (Date.now() < deadline) {
        if (fs.existsSync(samplePath)) {
          const sample = read();
          if (sample.token === token) return sample;
        }
        await new Promise(resolve => setTimeout(resolve, 25));
      }
      throw new Error("Memory sampler did not acknowledge the new measurement window.");
    }
  };
}

// Preloaded only in isolated test servers. Parent test processes import the
// factory without these environment variables and never start a sampling timer.
if (process.env.CARD_VAULT_TEST_MEMORY_PATH) {
  let peak = 0, token;
  const sample = () => {
    const next = JSON.parse(fs.readFileSync(process.env.CARD_VAULT_TEST_MEMORY_RESET, "utf8")).token;
    const rss = process.memoryUsage().rss;
    if (next !== token) { peak = rss; token = next; }
    peak = Math.max(peak, rss);
    writeJsonAtomic(process.env.CARD_VAULT_TEST_MEMORY_PATH, { rss, peak, token });
  };
  sample();
  setInterval(sample, Number(process.env.CARD_VAULT_TEST_MEMORY_INTERVAL)).unref();
}

module.exports = { createMemorySampler };
