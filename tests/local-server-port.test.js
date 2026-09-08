const assert = require("node:assert/strict");
const test = require("node:test");
const net = require("node:net");
const { selectLocalPort, probeLocalPort } = require("../electron/local-server-port");

test("reserved Windows preferred range falls back to a system-assigned port", async () => {
  const attempted = [];
  const port = await selectLocalPort({ probe: async port => {
    attempted.push(port);
    if (port) throw Object.assign(new Error("reserved"), { code: "EACCES" });
    return 45001;
  } });
  assert.equal(port, 45001);
  assert.deepEqual(attempted, [...Array.from({ length: 20 }, (_, i) => 3000 + i), 0]);
});

test("occupied ports are skipped and failure to allocate is actionable", async () => {
  assert.equal(await selectLocalPort({ probe: async port => {
    if (port === 3000) throw Object.assign(new Error("busy"), { code: "EADDRINUSE" });
    return port;
  } }), 3001);
  await assert.rejects(selectLocalPort({ preferredPort: null, probe: async () => { throw Object.assign(new Error("denied"), { code: "EACCES" }); } }), /EACCES/);
});

test("system-assigned loopback port is released after probing", async t => {
  const port = await probeLocalPort(0);
  assert.ok(port > 0 && port <= 65535);
  const server = net.createServer();
  t.after(() => server.close());
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen({ host: "127.0.0.1", port }, resolve); });
  await assert.rejects(probeLocalPort(port), { code: "EADDRINUSE" });
});
