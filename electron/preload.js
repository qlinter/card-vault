const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("cardVaultDesktop", {
  chooseStorageDirectory: () => ipcRenderer.invoke("card-vault:choose-storage-directory")
});
