async function resumeLocalServerWithRetry(runtime) {
  try {
    await runtime.resumeLocalServer();
  } catch (firstError) {
    const partialServer = runtime.stopServer();
    await runtime.waitForProcessExit(partialServer);
    await runtime.waitForAvailablePort(runtime.getServerPort());
    try {
      await runtime.resumeLocalServer();
    } catch (secondError) {
      throw new AggregateError([firstError, secondError], "本地数据服务重新连接失败，请保留当前窗口并查看日志。");
    }
  }
}

function notifyLifecycleHook(hook) {
  try {
    hook?.();
  } catch {
    // Progress notifications must never prevent the local service from reconnecting.
  }
}

async function runWithPausedLocalServer(runtime, task, hooks = {}) {
  let result;
  try {
    const child = runtime.stopServer();
    await runtime.waitForProcessExit(child);
    await runtime.waitForAvailablePort(runtime.getServerPort());
    result = await task();
  } catch (taskError) {
    notifyLifecycleHook(hooks.beforeRecovery);
    try {
      await resumeLocalServerWithRetry(runtime);
      notifyLifecycleHook(hooks.afterRecovery);
    } catch (resumeError) {
      throw new AggregateError([taskError, resumeError], "数据恢复失败，且本地数据服务未能重新连接。请保留当前窗口并查看日志。");
    }
    throw taskError;
  }

  notifyLifecycleHook(hooks.beforeResume);
  await resumeLocalServerWithRetry(runtime);
  notifyLifecycleHook(hooks.afterResume);
  return result;
}

module.exports = { resumeLocalServerWithRetry, runWithPausedLocalServer };
