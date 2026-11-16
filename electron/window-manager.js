const path = require("node:path");
const { BrowserWindow, shell } = require("electron");
const { isSameOriginUrl, normalizeExternalHttpUrl } = require("./navigation");
const { createSecureWebPreferences } = require("./window-options");

function createWindowManager({ serverRuntime, rootDir, logger }) {
  const appIconPath = path.join(rootDir, "build", "icon.ico");
  let mainWindow = null;
  let systemLocked = false;
  let lockedScreenReady = true;

  function isLocalAppUrl(rawUrl) { return isSameOriginUrl(rawUrl, serverRuntime.getServerUrl()); }
  function openSafeExternalUrl(rawUrl) {
    const externalUrl = normalizeExternalHttpUrl(rawUrl);
    if (!externalUrl) return false;
    void shell.openExternal(externalUrl).catch((error) => logger.appendLog("desktop.log", `Failed to open external URL: ${error.message}`));
    return true;
  }

  async function createMainWindow() {
    mainWindow = new BrowserWindow({ width: 1400, height: 900, minWidth: 1100, minHeight: 760, backgroundColor: "#10131a", autoHideMenuBar: true, show: false, title: "Card Vault", icon: appIconPath, webPreferences: createSecureWebPreferences(path.join(__dirname, "preload.js")) });
    mainWindow.webContents.setWindowOpenHandler(({ url }) => { if (!isLocalAppUrl(url)) openSafeExternalUrl(url); return { action: "deny" }; });
    const guardNavigation = (event, url) => { if (isLocalAppUrl(url)) return; event.preventDefault(); openSafeExternalUrl(url); };
    mainWindow.webContents.on("will-navigate", guardNavigation);
    mainWindow.webContents.on("will-redirect", guardNavigation);
    mainWindow.once("ready-to-show", () => { if (process.env.CARD_VAULT_ACCEPTANCE_MODE !== "1") mainWindow?.show(); });
    const sessionCookie = serverRuntime.getSessionCookie();
    // Discard media cached by versions that predate account protection.
    await mainWindow.webContents.session.clearCache();
    await mainWindow.webContents.session.cookies.set({
      url: serverRuntime.getServerUrl(),
      name: sessionCookie.name,
      value: sessionCookie.value,
      httpOnly: true,
      sameSite: "strict",
      secure: false,
      path: "/"
    });
    await mainWindow.loadURL(serverRuntime.getServerUrl());
  }

  function getMainWindow() { return mainWindow; }
  function focusMainWindow() { if (!mainWindow || systemLocked || !lockedScreenReady || process.env.CARD_VAULT_ACCEPTANCE_MODE === "1") return; if (mainWindow.isMinimized()) mainWindow.restore(); mainWindow.show(); mainWindow.focus(); }

  function hideForSystemLock() {
    systemLocked = true; lockedScreenReady = false;
    if (!mainWindow || mainWindow.isDestroyed()) return;
    mainWindow.hide();
    mainWindow.webContents.send("card-vault:account-locked");
  }
  async function loadLockedScreen() {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    // Backup/restore can pause Next while the OS locks. Wait for its existing
    // operation to finish, without killing a committed write or backup worker.
    await serverRuntime.waitForServer(serverRuntime.getServerUrl(), 600000);
    await mainWindow.loadURL(serverRuntime.getServerUrl() + "/login");
    lockedScreenReady = true;
    if (!systemLocked) focusMainWindow();
  }
  function showLockedScreen() { systemLocked = false; if (lockedScreenReady) focusMainWindow(); }

  return { createMainWindow, getMainWindow, focusMainWindow, hideForSystemLock, loadLockedScreen, showLockedScreen };
}

module.exports = { createWindowManager };
