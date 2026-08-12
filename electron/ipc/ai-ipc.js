function registerAiIpc({ ipcMain, aiConfig, runtime, logger }) {
  ipcMain.handle("card-vault:get-ai-settings", async () => aiConfig.getPublicSettings());
  ipcMain.on("card-vault:preload-ready", () => logger.appendLog("desktop.log", "Desktop preload bridge ready."));
  ipcMain.handle("card-vault:save-ai-settings", async (_event, settings) => {
    try {
      const result = aiConfig.save(settings ?? {});
      logger.appendLog("desktop.log", "Encrypted AI settings saved; applying them to the local service.");
      await runtime.restartLocalServer();
      return result;
    } catch (error) { logger.appendLog("desktop.log", `AI settings save failed: ${error instanceof Error ? error.message : "Unknown AI settings error."}`); throw error; }
  });
}

module.exports = { registerAiIpc };
