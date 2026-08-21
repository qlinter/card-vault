const path = require("node:path");
const { BrowserWindow, shell } = require("electron");
const { isSameOriginUrl, normalizeExternalHttpUrl } = require("./navigation");
const { createSecureWebPreferences } = require("./window-options");

function createWindowManager({ serverRuntime, rootDir, logger }) {
  const appIconPath = path.join(rootDir, "build", "icon.ico");
  let mainWindow = null;

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
    mainWindow.once("ready-to-show", () => mainWindow?.show());
    const sessionCookie = serverRuntime.getSessionCookie();
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
  function focusMainWindow() { if (!mainWindow) return; if (mainWindow.isMinimized()) mainWindow.restore(); mainWindow.show(); mainWindow.focus(); }

  return { createMainWindow, getMainWindow, focusMainWindow };
}

module.exports = { createWindowManager };
