function createOperationCoordinator() {
  let active = null;
  return async function runExclusiveOperation(name, task) {
    if (active) throw new Error(`任务“${active}”正在执行，请等待完成后重试。`);
    active = name;
    try { return await task(); } finally { active = null; }
  };
}

module.exports = { createOperationCoordinator };
