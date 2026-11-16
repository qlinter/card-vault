const assert = require("node:assert/strict");
const test = require("node:test");
const { registerStorageIpc } = require("../electron/ipc/storage-ipc");

test("a file picker opened before locking cannot change storage or start a restore afterward", async () => {
  const handlers = new Map();
  let loggedIn = true, changes = 0;
  const frame = { url: "http://127.0.0.1:3007/settings" };
  const event = { senderFrame: frame, sender: { mainFrame: frame, isDestroyed: () => false, send: () => {} } };
  registerStorageIpc({
    ipcMain: { handle: (name, handler) => handlers.set(name, handler) }, app: {}, shell: {},
    logger: { appendLog: () => {} },
    runtime: {
      getServerUrl: () => "http://127.0.0.1:3007",
      requireAccount: async () => { if (!loggedIn) throw new Error("login required"); },
      runExclusiveOperation: async (_name, action) => action(),
      getStorageWorkerPath: () => { throw new Error("An unauthorized storage worker must never start"); }
    },
    storage: { getBackupDir: () => "backup", getDataDir: () => "data", chooseBackupDir: () => { changes++; } },
    dialog: { showOpenDialog: async () => { loggedIn = false; return { canceled: false, filePaths: ["selected"] }; } }
  });
  for (const channel of ["choose-storage-directory", "choose-backup-directory", "restore-data-folder"]) {
    loggedIn = true;
    await assert.rejects(handlers.get("card-vault:" + channel)(event), /login required/);
  }
  assert.equal(changes, 0);
});
