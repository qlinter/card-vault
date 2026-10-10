const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { _electron: electron } = require("@playwright/test");

async function checkPackagedDesktop(executable, version, { env, userData, playerName, query }) {
  const logPath = path.join(userData, "logs", "desktop.log");
  const offset = fs.existsSync(logPath) ? fs.readFileSync(logPath, "utf8").length : 0;
  const desktop = await electron.launch({ executablePath: executable, env, timeout: 60000 });
  try {
    assert.equal(await desktop.evaluate(({ app }) => app.getVersion()), version);
    // firstWindow can arrive before the main-process loadURL promise completes.
    // Navigating at that point aborts startup rather than exercising normal use.
    const deadline = Date.now() + 60000;
    let ready = false;
    while (Date.now() < deadline) {
      const log = fs.existsSync(logPath) ? fs.readFileSync(logPath, "utf8").slice(offset) : "";
      assert.ok(!log.includes("Startup failed:"), log);
      if (log.includes("Desktop app boot completed.")) { ready = true; break; }
      await new Promise(resolve => setTimeout(resolve, 250));
    }
    assert.ok(ready, "Packaged desktop did not complete startup.");
    const window = await desktop.firstWindow();
    await window.getByText(playerName, { exact: true }).first().waitFor({ timeout: 60000 });
    assert.equal(await desktop.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isVisible()), false);
    const preferences = await desktop.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences());
    assert.equal(preferences.sandbox, true); assert.equal(preferences.nodeIntegration, false);
    const origin = new URL(window.url()).origin;
    await window.goto(`${origin}/?q=${encodeURIComponent(query)}&sort=yearAsc`, { waitUntil: "networkidle" });
    await window.getByTestId("home-card-grid").locator(".card-item a").first().click();
    await window.locator(".title-row").getByRole("link", { name: "编辑", exact: true }).click();
    await window.getByRole("button", { name: "保存修改", exact: true }).click();
    await window.waitForURL(/success=updated/);
    await window.getByRole("link", { name: "返回上一页", exact: true }).click();
    const isFiltered = url => url.pathname === "/" && url.searchParams.get("q") === query && url.searchParams.get("sort") === "yearAsc";
    await window.waitForURL(isFiltered);
    await window.getByTestId("home-card-grid").locator(".card-item a").first().click();
    for (let attempt = 0; attempt < 2; attempt++) {
      await window.locator(".title-row").getByRole("link", { name: "编辑", exact: true }).click();
      await window.getByRole("link", { name: "取消", exact: true }).click();
    }
    await window.getByRole("link", { name: "返回上一页", exact: true }).click();
    await window.waitForURL(isFiltered);
  } finally { await desktop.close(); }
}

module.exports = { checkPackagedDesktop };
