const assert = require("node:assert/strict");
const http = require("node:http");
const test = require("node:test");
const { fetchTestServer } = require("../scripts/test-http-flow-utils");

async function localServer(t, handler) {
  const server = http.createServer(handler);
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  return `http://127.0.0.1:${server.address().port}`;
}

test("fixture HTTP requests use separate connections and preserve headers, bodies and error responses", async t => {
  const sockets = new Set();
  const requests = [];
  const base = await localServer(t, (request, response) => {
    sockets.add(request.socket);
    let body = "";
    request.setEncoding("utf8");
    request.on("data", chunk => { body += chunk; });
    request.on("end", () => {
      requests.push({ method: request.method, headers: request.headers, body });
      response.writeHead(request.method === "POST" ? 400 : 200, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ ok: request.method !== "POST" }));
    });
  });
  assert.deepEqual(await (await fetchTestServer(base)).json(), { ok: true });
  const response = await fetchTestServer(base, {
    method: "POST", headers: new Headers({ "Content-Type": "application/json", Origin: base }),
    body: JSON.stringify({ id: "missing-wish" })
  });
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { ok: false });
  assert.equal(sockets.size, 2);
  assert.ok(requests.every(request => request.headers.connection === "close"));
  assert.equal(requests[1].headers["content-type"], "application/json");
  assert.equal(requests[1].headers.origin, base);
  assert.deepEqual(JSON.parse(requests[1].body), { id: "missing-wish" });
});

test("a reset write fails with request context and is not retried", async t => {
  let writes = 0;
  const base = await localServer(t, request => {
    writes++;
    request.resume();
    request.on("end", () => request.socket.destroy());
  });
  await assert.rejects(fetchTestServer(`${base}/write`, { method: "POST", body: "payload" }), error => {
    assert.equal(error.message, `POST ${base}/write failed`);
    assert.ok(error.cause instanceof Error);
    return true;
  });
  assert.equal(writes, 1);
});
