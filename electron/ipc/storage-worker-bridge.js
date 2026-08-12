const { spawn } = require("node:child_process");

function createStorageWorkerBridge({ app, runtime, storage, logger }) {
  let activeStorageOperation = null;

  function sendStorageProgress(sender, operation, progress) {
    if (!sender || sender.isDestroyed()) return;
    sender.send("card-vault:storage-progress", {
      operation,
      percent: Math.max(0, Math.min(100, Math.round(progress.percent ?? 0))),
      message: typeof progress.message === "string" ? progress.message : "正在处理...",
      done: Boolean(progress.done)
    });
  }

  function runStorageWorker(sender, workerOperation, payload = {}, progressRange = { start: 0, end: 100 }, displayOperation = workerOperation) {
    return new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [runtime.getStorageWorkerPath()], {
        cwd: runtime.getRootDir(),
        windowsHide: true,
        env: { ...process.env, ...storage.getEnv(), ELECTRON_RUN_AS_NODE: "1" },
        stdio: ["ignore", "pipe", "pipe", "ipc"]
      });
      let settled = false;
      child.stdout.on("data", (chunk) => logger.appendLog("storage-worker.log", chunk.toString().trimEnd()));
      child.stderr.on("data", (chunk) => logger.appendLog("storage-worker.log", chunk.toString().trimEnd()));
      child.on("message", (message) => {
        if (!message || typeof message !== "object") return;
        if (message.type === "progress") {
          const workerPercent = Math.max(0, Math.min(100, Number(message.progress?.percent) || 0));
          sendStorageProgress(sender, displayOperation, {
            percent: progressRange.start + ((progressRange.end - progressRange.start) * workerPercent) / 100,
            message: message.progress?.message
          });
        } else if (message.type === "result") {
          settled = true;
          resolve(message.result);
        } else if (message.type === "error") {
          settled = true;
          reject(new Error(message.error?.message || "Storage worker failed."));
        }
      });
      child.on("error", (error) => {
        if (!settled) {
          settled = true;
          reject(error);
        }
      });
      child.on("exit", (code) => {
        if (!settled) {
          settled = true;
          reject(new Error(`Storage worker exited with code ${code ?? "unknown"}.`));
        }
      });
      child.send({ operation: workerOperation, payload, config: { appDataRoot: app.getPath("userData"), projectRoot: runtime.getRootDir() } });
    });
  }

  async function withStorageOperation(event, operation, callback) {
    if (activeStorageOperation) throw new Error(`存储任务“${activeStorageOperation}”正在执行，请等待完成后重试。`);
    activeStorageOperation = operation;
    sendStorageProgress(event.sender, operation, { percent: 0, message: "正在准备任务..." });
    try {
      return await callback(event.sender);
    } finally {
      sendStorageProgress(event.sender, operation, { percent: 100, message: "任务已结束。", done: true });
      activeStorageOperation = null;
    }
  }

  return { sendStorageProgress, runStorageWorker, withStorageOperation };
}

module.exports = { createStorageWorkerBridge };
