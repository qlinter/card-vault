function reportProgress(callback, percent, message) {
  if (typeof callback !== "function") return;
  try {
    callback({ percent: Math.max(0, Math.min(100, Math.round(percent))), message });
  } catch {
    // Progress reporting must never interrupt a storage operation.
  }
}

function mapProgress(callback, start, end) {
  return ({ percent, message }) => {
    reportProgress(callback, start + ((end - start) * percent) / 100, message);
  };
}

module.exports = { reportProgress, mapProgress };
