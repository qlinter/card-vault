"use strict";

// Exercises Chromium's real PAC engine in an isolated session; no OS settings change.
if (process.versions.electron) {
  const { app, session } = require("electron");
  const { systemProxyUrls } = require("../lib/ai-proxy-core");
  app.setPath("userData", process.env.CARD_VAULT_PROXY_TEST_DIR);
  app.whenReady().then(async () => {
    const isolated = session.fromPartition("card-vault-local-pac-test");
    await isolated.setProxy({ mode: "pac_script", pacScript: process.env.CARD_VAULT_PROXY_TEST_PAC });
    const proxied = await isolated.resolveProxy("https://proxy-fixture.invalid/v1/models");
    const direct = await isolated.resolveProxy("https://direct-fixture.invalid/v1/models");
    const socks = await isolated.resolveProxy("https://socks-fixture.invalid/v1/models");
    const candidates = systemProxyUrls(proxied);
    if (candidates.length !== 3 || !candidates[0].startsWith("http:") || !candidates[1].startsWith("https:") || candidates[2] !== "" || systemProxyUrls(direct)[0] !== "" || !systemProxyUrls(socks)[0].startsWith("socks5:")) throw new Error("Unexpected Chromium PAC routing result");
    console.log("Real Electron PAC passed: HTTP, HTTPS, SOCKS5, ordered candidates and DIRECT.");
    await isolated.closeAllConnections(); app.exit(0);
  }).catch(error => { console.error(error.message); app.exit(1); });
} else {
  const fs = require("node:fs"), os = require("node:os"), path = require("node:path"), http = require("node:http");
  const { spawn } = require("node:child_process");
  const { once } = require("node:events");
  async function main() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "card-vault-local-pac-"));
    const server = http.createServer((_request, response) => {
      response.setHeader("Content-Type", "application/x-ns-proxy-autoconfig");
      response.end('function FindProxyForURL(url,host){ if(host==="proxy-fixture.invalid") return "PROXY 127.0.0.1:18081; HTTPS 127.0.0.1:18082; DIRECT"; if(host==="socks-fixture.invalid") return "SOCKS5 127.0.0.1:18083"; return "DIRECT"; }');
    });
    let child, timer;
    try {
      server.listen(0, "127.0.0.1"); await once(server, "listening");
      const env = { ...process.env, CARD_VAULT_PROXY_TEST_DIR: root, CARD_VAULT_PROXY_TEST_PAC: `http://127.0.0.1:${server.address().port}/proxy.pac` };
      delete env.ELECTRON_RUN_AS_NODE;
      child = spawn(require("electron"), [__filename], { env, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
      let output = ""; child.stdout.on("data", data => { output += data; }); child.stderr.on("data", data => { output += data; });
      timer = setTimeout(() => child.kill(), 20000);
      const [code] = await once(child, "exit");
      if (code !== 0 || !output.includes("Real Electron PAC passed")) throw new Error(output || "Electron PAC fixture did not finish");
      console.log("Real Electron PAC passed: HTTP, HTTPS, SOCKS5, ordered candidates and DIRECT.");
    } finally {
      clearTimeout(timer); child?.kill();
      await new Promise(resolve => server.close(resolve));
      fs.rmSync(root, { recursive: true, force: true });
    }
  }
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
