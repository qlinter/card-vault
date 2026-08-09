const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("cardVaultDesktop", {
  chooseStorageDirectory: () => ipcRenderer.invoke("card-vault:choose-storage-directory"),
  getBackupSettings: () => ipcRenderer.invoke("card-vault:get-backup-settings"),
  chooseBackupDirectory: () => ipcRenderer.invoke("card-vault:choose-backup-directory"),
  backupDataFolder: () => ipcRenderer.invoke("card-vault:backup-data-folder"),
  checkDataHealth: () => ipcRenderer.invoke("card-vault:check-data-health"),
  showOrphanFileInFolder: (file) => ipcRenderer.invoke("card-vault:show-orphan-file-in-folder", file),
  cleanOrphanFiles: () => ipcRenderer.invoke("card-vault:clean-orphan-files"),
  restoreDataFolder: () => ipcRenderer.invoke("card-vault:restore-data-folder"),
  getAiSettings: () => ipcRenderer.invoke("card-vault:get-ai-settings"),
  saveAiSettings: (settings) => ipcRenderer.invoke("card-vault:save-ai-settings", settings)
});

ipcRenderer.send("card-vault:preload-ready");
