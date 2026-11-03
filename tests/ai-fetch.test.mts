import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import http from "node:http";
import https from "node:https";
import fs from "node:fs";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import net, { type Socket } from "node:net";
import { once } from "node:events";
import { fetchAi } from "../lib/ai-fetch.ts";
import { normalizeAiProxy } from "../lib/ai-proxy-core.js";

function cleanEnvironment(t: TestContext) {
  for (const name of ["http_proxy", "HTTP_PROXY", "https_proxy", "HTTPS_PROXY", "all_proxy", "ALL_PROXY", "no_proxy", "NO_PROXY", "CARD_VAULT_DESKTOP_PROXY_BRIDGE"]) {
    const original = process.env[name];
    delete process.env[name];
    t.after(() => { if (original === undefined) delete process.env[name]; else process.env[name] = original; });
  }
}

async function listen(t: TestContext, server: net.Server) {
  const sockets = new Set<Socket>();
  server.on("connection", socket => { sockets.add(socket); socket.on("error", () => {}); socket.on("close", () => sockets.delete(socket)); });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(async () => { for (const socket of sockets) socket.destroy(); await new Promise<void>(resolve => server.close(() => resolve())); });
  return (server.address() as net.AddressInfo).port;
}

async function upstream(t: TestContext) {
  const requests: http.IncomingMessage[] = [];
  const port = await listen(t, http.createServer((request, response) => {
    requests.push(request);
    response.setHeader("Content-Type", "application/json");
    response.end(JSON.stringify({ ok: true }));
  }));
  return { port, requests, url: `http://127.0.0.1:${port}/v1/models` };
}

async function httpProxy(t: TestContext, upstreamPort: number, accept = true, secure = false, authority = "model.invalid:80") {
  const connections: http.IncomingMessage[] = [];
  const server = secure ? https.createServer({ key: fs.readFileSync(new URL("./fixtures/tls/proxy-key.pem", import.meta.url)), cert: fs.readFileSync(new URL("./fixtures/tls/proxy-cert.pem", import.meta.url)) }) : http.createServer();
  server.on("connect", (request, client, head) => {
    connections.push(request);
    if (!accept || request.url !== authority) { client.end("HTTP/1.1 407 Proxy Authentication Required\r\n\r\n"); return; }
    // This fixture only connects to a loopback upstream, never the requested hostname.
    const target = net.connect(upstreamPort, "127.0.0.1", () => {
      client.write("HTTP/1.1 200 Connection Established\r\n\r\n");
      if (head.length) target.write(head);
      client.pipe(target).pipe(client);
    });
    client.on("close", () => target.destroy());
    target.on("error", () => client.destroy());
  });
  return { port: await listen(t, server), connections };
}

async function socksProxy(t: TestContext, upstreamPort: number) {
  const credentials: Array<{ username: string; password: string }> = [];
  const targets: string[] = [];
  const server = net.createServer(client => {
    let state = "greeting", buffer = Buffer.alloc(0);
    const receive = (data: Buffer) => {
      buffer = Buffer.concat([buffer, data]);
      if (state === "greeting") {
        if (buffer.length < 2 || buffer.length < 2 + buffer[1]) return;
        buffer = buffer.subarray(2 + buffer[1]);
        client.write(Buffer.from([5, 2]));
        state = "auth";
      }
      if (state === "auth") {
        if (buffer.length < 2 || buffer.length < 3 + buffer[1]) return;
        const passwordOffset = 2 + buffer[1], length = passwordOffset + 1 + buffer[passwordOffset];
        if (buffer.length < length) return;
        credentials.push({ username: buffer.subarray(2, passwordOffset).toString(), password: buffer.subarray(passwordOffset + 1, length).toString() });
        buffer = buffer.subarray(length);
        client.write(Buffer.from([1, 0]));
        state = "connect";
      }
      if (state === "connect") {
        if (buffer.length < 5) return;
        if (buffer[3] !== 3) { client.destroy(); return; }
        const length = 7 + buffer[4];
        if (buffer.length < length) return;
        const host = buffer.subarray(5, 5 + buffer[4]).toString();
        targets.push(host);
        if (host !== "model.invalid") { client.destroy(); return; }
        client.off("data", receive);
        const target = net.connect(upstreamPort, "127.0.0.1", () => {
          client.write(Buffer.from([5, 0, 0, 1, 127, 0, 0, 1, 0, 80]));
          if (buffer.length > length) target.write(buffer.subarray(length));
          client.pipe(target).pipe(client);
        });
        client.on("close", () => target.destroy());
        target.on("error", () => client.destroy());
        state = "tunnel";
      }
    };
    client.on("data", receive);
  });
  return { port: await listen(t, server), credentials, targets };
}

test("HTTP proxy forwards AI requests and keeps special-character credentials off the upstream", { timeout: 8000 }, async t => {
  cleanEnvironment(t);
  const backend = await upstream(t), proxy = await httpProxy(t, backend.port);
  const username = "collector@team", password = "p:/%密";
  const response = await fetchAi("http://model.invalid/v1/models", { signal: AbortSignal.timeout(5000), headers: { Authorization: "Bearer fixture-key" } }, normalizeAiProxy({ mode: "manual", host: "127.0.0.1", port: proxy.port, username, password }));
  assert.deepEqual(await response.json(), { ok: true });
  assert.equal(proxy.connections[0].headers["proxy-authorization"], "Basic " + Buffer.from(username + ":" + password).toString("base64"));
  assert.equal(backend.requests[0].headers.authorization, "Bearer fixture-key");
  assert.equal(backend.requests[0].headers["proxy-authorization"], undefined);
});

function systemRules(t: TestContext, rules: string) {
  const send = Object.getOwnPropertyDescriptor(process, "send"), connected = Object.getOwnPropertyDescriptor(process, "connected");
  t.after(() => {
    if (send) Object.defineProperty(process, "send", send); else delete process.send;
    if (connected) Object.defineProperty(process, "connected", connected); else delete process.connected;
  });
  process.env.CARD_VAULT_DESKTOP_PROXY_BRIDGE = "1";
  Object.defineProperty(process, "connected", { configurable: true, value: true });
  Object.defineProperty(process, "send", { configurable: true, value: (message: { id: string }, callback: (error: Error | null) => void) => {
    callback(null); queueMicrotask(() => process.emit("message", { type: "card-vault:ai-proxy-result", id: message.id, proxy: rules })); return true;
  } });
}

test("system proxy failover follows explicit candidates without inventing direct access", { timeout: 8000 }, async t => {
  cleanEnvironment(t);
  const backend = await upstream(t), denied = await httpProxy(t, backend.port, false), working = await httpProxy(t, backend.port);
  systemRules(t, `PROXY 127.0.0.1:${denied.port}; PROXY 127.0.0.1:${working.port}`);
  const routes: unknown[] = [];
  const response = await fetchAi("http://model.invalid/v1/models", { signal: AbortSignal.timeout(5000) }, normalizeAiProxy({ noProxy: "" }), route => routes.push(route));
  await response.text();
  assert.equal(denied.connections.length, 1); assert.equal(working.connections.length, 1); assert.equal(backend.requests.length, 1);
  assert.deepEqual(routes.map(route => (route as { attempt: number }).attempt), [1, 2]);
  systemRules(t, `PROXY 127.0.0.1:${denied.port}`);
  await assert.rejects(fetchAi(backend.url, { signal: AbortSignal.timeout(5000) }, normalizeAiProxy({ noProxy: "" })), /代理认证/);
  assert.equal(backend.requests.length, 1);
  systemRules(t, `PROXY 127.0.0.1:${denied.port}; DIRECT`);
  await (await fetchAi(backend.url, { signal: AbortSignal.timeout(5000) }, normalizeAiProxy({ noProxy: "" }))).text();
  assert.equal(backend.requests.length, 2);
});

test("redirects re-evaluate bypass rules and strip custom credentials across origins", { timeout: 8000 }, async t => {
  cleanEnvironment(t);
  const backend = await upstream(t);
  const redirectPort = await listen(t, http.createServer((request, response) => { request.resume(); response.writeHead(303, { Location: backend.url }); response.end(); }));
  const proxy = await httpProxy(t, redirectPort), routes: string[] = [];
  const response = await fetchAi("http://model.invalid/start", { method: "POST", body: '{"fixture":true}', headers: { Authorization: "Bearer fixture", "api-key": "private-test", "x-custom-credential": "private-test", Cookie: "private-test" }, signal: AbortSignal.timeout(5000) }, normalizeAiProxy({ mode: "manual", host: "127.0.0.1", port: proxy.port }), route => routes.push(route.source));
  await response.text();
  assert.deepEqual(routes, ["manual", "bypass"]);
  assert.equal(proxy.connections.length, 1);
  assert.equal(backend.requests[0].method, "GET");
  for (const header of ["authorization", "api-key", "x-custom-credential", "cookie"]) assert.equal(backend.requests[0].headers[header], undefined);
});

test("redirects can switch from local bypass to an environment proxy", { timeout: 8000 }, async t => {
  cleanEnvironment(t);
  const backend = await upstream(t), proxy = await httpProxy(t, backend.port);
  process.env.http_proxy = `http://127.0.0.1:${proxy.port}`;
  const start = await listen(t, http.createServer((request, response) => { request.resume(); response.writeHead(307, { Location: "http://model.invalid/v1/models" }); response.end(); }));
  const response = await fetchAi(`http://127.0.0.1:${start}/start`, { signal: AbortSignal.timeout(5000) });
  await response.text(); assert.equal(proxy.connections.length, 1); assert.equal(backend.requests.length, 1);
});

test("HTTPS proxies verify TLS using an explicitly trusted local test certificate", { timeout: 10000 }, async t => {
  cleanEnvironment(t);
  let received = 0;
  const backendPort = await listen(t, https.createServer({ key: fs.readFileSync(new URL("./fixtures/tls/proxy-key.pem", import.meta.url)), cert: fs.readFileSync(new URL("./fixtures/tls/proxy-cert.pem", import.meta.url)) }, (request, response) => { received++; request.resume(); response.end('{"ok":true}'); }));
  const authority = `localhost:${backendPort}`;
  const proxy = await httpProxy(t, backendPort, true, true, authority), plainProxy = await httpProxy(t, backendPort, true, false, authority);
  const url = new URL("../lib/ai-fetch.ts", import.meta.url).href;
  const code = `import {fetchAi} from ${JSON.stringify(url)}; for (const [protocol,port] of [['https','${proxy.port}'],['http','${plainProxy.port}']]) {const response=await fetchAi('https://${authority}/v1/models',{signal:AbortSignal.timeout(5000)},{mode:'manual',protocol,host:'127.0.0.1',port,noProxy:''}); console.log(await response.text());}`;
  const child = spawn(process.execPath, ["--disable-warning=MODULE_TYPELESS_PACKAGE_JSON", "--input-type=module", "-e", code], { env: { ...process.env, NODE_EXTRA_CA_CERTS: fileURLToPath(new URL("./fixtures/tls/proxy-cert.pem", import.meta.url)) }, windowsHide: true });
  t.after(() => child.kill());
  let output = ""; child.stdout.on("data", chunk => { output += chunk; }); child.stderr.on("data", chunk => { output += chunk; });
  const [status] = await once(child, "exit");
  assert.equal(status, 0, output); assert.match(output, /"ok":true/); assert.equal(proxy.connections.length, 1); assert.equal(plainProxy.connections.length, 1);
  await assert.rejects(fetchAi(`https://${authority}/v1/models`, { signal: AbortSignal.timeout(5000) }, normalizeAiProxy({ mode: "manual", protocol: "https", host: "127.0.0.1", port: proxy.port, noProxy: "" })), /安全连接验证失败/);
  assert.equal(received, 2);
});

test("HTTP proxy authentication accepts a username with an empty password", { timeout: 8000 }, async t => {
  cleanEnvironment(t);
  const backend = await upstream(t), proxy = await httpProxy(t, backend.port);
  const response = await fetchAi("http://model.invalid/v1/models", { signal: AbortSignal.timeout(5000) }, normalizeAiProxy({ mode: "manual", host: "127.0.0.1", port: proxy.port, username: "collector" }));
  await response.text();
  assert.equal(proxy.connections[0].headers["proxy-authorization"], "Basic " + Buffer.from("collector:").toString("base64"));
});

test("SOCKS5 resolves the target through the proxy and decodes authentication exactly once", { timeout: 8000 }, async t => {
  cleanEnvironment(t);
  const backend = await upstream(t), proxy = await socksProxy(t, backend.port);
  const username = "collector@team", password = "p:/%密";
  const response = await fetchAi("http://model.invalid/v1/models", { signal: AbortSignal.timeout(5000) }, normalizeAiProxy({ mode: "manual", protocol: "socks5", host: "127.0.0.1", port: proxy.port, username, password }));
  assert.deepEqual(await response.json(), { ok: true });
  assert.deepEqual(proxy.credentials, [{ username, password }]);
  assert.deepEqual(proxy.targets, ["model.invalid"]);
});

test("automatic mode reads environment changes and direct or bypass modes ignore the proxy", { timeout: 8000 }, async t => {
  cleanEnvironment(t);
  const backend = await upstream(t), proxy = await httpProxy(t, backend.port);
  process.env.http_proxy = `http://127.0.0.1:${proxy.port}`;
  let response = await fetchAi("http://model.invalid/v1/models", { signal: AbortSignal.timeout(5000) });
  await response.text();
  assert.equal(proxy.connections.length, 1);
  process.env.http_proxy = "http://127.0.0.1:1";
  for (const settings of [{ mode: "direct" }, { mode: "manual", host: "127.0.0.1", port: "1" }, { mode: "auto" }]) {
    response = await fetchAi(backend.url, { signal: AbortSignal.timeout(5000) }, normalizeAiProxy(settings));
    await response.text();
  }
  process.env.NO_PROXY = "127.0.0.1";
  response = await fetchAi(backend.url, { signal: AbortSignal.timeout(5000) }, normalizeAiProxy({ noProxy: "" }));
  await response.text();
  assert.equal(backend.requests.length, 5);
  assert.equal(proxy.connections.length, 1);
});

test("a rejected proxy does not fall back to direct access or reveal credentials", { timeout: 8000 }, async t => {
  cleanEnvironment(t);
  const backend = await upstream(t), proxy = await httpProxy(t, backend.port, false);
  await assert.rejects(fetchAi(backend.url, { signal: AbortSignal.timeout(5000) }, normalizeAiProxy({ mode: "manual", host: "127.0.0.1", port: proxy.port, noProxy: "", username: "fixture-user", password: "fixture-secret" })), error => {
    assert.ok(error instanceof Error);
    assert.match(error.message, /代理/);
    assert.doesNotMatch(error.message, /fixture-user|fixture-secret/);
    return true;
  });
  assert.equal(backend.requests.length, 0);
});

test("desktop automatic mode resolves system rules for each target and cleans up after cancellation", { timeout: 8000 }, async t => {
  cleanEnvironment(t);
  const backend = await upstream(t), proxy = await httpProxy(t, backend.port);
  const originalSend = Object.getOwnPropertyDescriptor(process, "send");
  const originalConnected = Object.getOwnPropertyDescriptor(process, "connected");
  t.after(() => {
    if (originalSend) Object.defineProperty(process, "send", originalSend); else delete process.send;
    if (originalConnected) Object.defineProperty(process, "connected", originalConnected); else delete process.connected;
  });
  const targets: string[] = [];
  let respond = true;
  Object.defineProperty(process, "connected", { configurable: true, value: true });
  Object.defineProperty(process, "send", { configurable: true, value: (message: { id: string; url: string }, callback: (error: Error | null) => void) => {
    targets.push(message.url);
    callback(null);
    if (respond) queueMicrotask(() => process.emit("message", { type: "card-vault:ai-proxy-result", id: message.id, proxy: message.url.includes("model.invalid") ? `PROXY 127.0.0.1:${proxy.port}` : "DIRECT" }));
    return true;
  } });
  process.env.CARD_VAULT_DESKTOP_PROXY_BRIDGE = "1";
  const settings = normalizeAiProxy({ noProxy: "" }), listeners = process.listenerCount("message");
  for (const target of ["http://model.invalid/v1/models", backend.url]) {
    const response = await fetchAi(target, { signal: AbortSignal.timeout(5000) }, settings);
    await response.text();
  }
  assert.deepEqual(targets, ["http://model.invalid/v1/models", backend.url]);
  assert.equal(proxy.connections.length, 1);
  assert.equal(process.listenerCount("message"), listeners);
  respond = false;
  const controller = new AbortController();
  const pending = fetchAi("http://model.invalid/v1/models", { signal: controller.signal }, settings);
  controller.abort();
  await assert.rejects(pending, { name: "AbortError" });
  assert.equal(process.listenerCount("message"), listeners);
  assert.equal(proxy.connections.length, 1);
});
