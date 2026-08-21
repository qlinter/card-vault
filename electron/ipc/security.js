const { isSameOriginUrl } = require("../navigation");

function ipcSenderUrl(event) {
  return event?.senderFrame?.url || "";
}

function isTrustedIpcSender(event, baseUrl) {
  return isSameOriginUrl(ipcSenderUrl(event), baseUrl);
}

function assertTrustedIpcSender(event, baseUrl) {
  if (!isTrustedIpcSender(event, baseUrl)) throw new Error("拒绝来自非 Card Vault 页面调用的桌面功能。");
}

function createTrustedIpcRegistrar(ipcMain, getBaseUrl) {
  return (channel, handler) => ipcMain.handle(channel, async (event, ...args) => {
    assertTrustedIpcSender(event, getBaseUrl());
    return handler(event, ...args);
  });
}

module.exports = { assertTrustedIpcSender, createTrustedIpcRegistrar, ipcSenderUrl, isTrustedIpcSender };
