const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("cardVaultDesktop", {
  chooseStorageDirectory: () => ipcRenderer.invoke("card-vault:choose-storage-directory"),
  getAiSettings: () => ipcRenderer.invoke("card-vault:get-ai-settings"),
  saveAiSettings: (settings) => ipcRenderer.invoke("card-vault:save-ai-settings", settings)
});
