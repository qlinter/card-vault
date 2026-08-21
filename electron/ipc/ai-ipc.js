const { createTrustedIpcRegistrar, isTrustedIpcSender } = require("./security");

function registerAiIpc({ ipcMain, aiConfig, runtime, logger }) {
  const trustedHandle = createTrustedIpcRegistrar(ipcMain, () => runtime.getServerUrl());

  trustedHandle("card-vault:get-ai-settings", async () => aiConfig.getPublicSettings());
  ipcMain.on("card-vault:preload-ready", (event) => {
    if (isTrustedIpcSender(event, runtime.getServerUrl())) logger.appendLog("desktop.log", "Desktop preload bridge ready.");
  });
  trustedHandle("card-vault:save-ai-settings", async (_event, settings) => {
    try {
      const result = aiConfig.save(settings ?? {});
      logger.appendLog("desktop.log", "Encrypted AI settings saved; applying them to the local service.");
      await runtime.restartLocalServer();
      return result;
    } catch (error) { logger.appendLog("desktop.log", `AI settings save failed: ${error instanceof Error ? error.message : "Unknown AI settings error."}`); throw error; }
  });
}

module.exports = { registerAiIpc };
