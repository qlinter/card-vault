const { runStorageTask } = require("./storage-task");

let started = false;

function send(message) {
  return new Promise((resolve) => {
    if (typeof process.send !== "function") {
      resolve();
      return;
    }
    process.send(message, resolve);
  });
}

process.on("message", async (request) => {
  if (started) {
    return;
  }
  started = true;

  try {
    const result = runStorageTask(request, (progress) => {
      void send({ type: "progress", progress });
    });
    await send({ type: "result", result, workerPid: process.pid });
    process.exitCode = 0;
  } catch (error) {
    await send({
      type: "error",
      error: {
        message: error instanceof Error ? error.message : "Unknown storage worker error.",
        stack: error instanceof Error ? error.stack : undefined
      }
    });
    process.exitCode = 1;
  } finally {
    process.disconnect?.();
  }
});
