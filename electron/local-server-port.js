const net = require("node:net");

function probeLocalPort(port) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.once("error", reject);
    server.listen({ host: "127.0.0.1", port, exclusive: true }, () => {
      const selected = server.address().port;
      server.close(error => error ? reject(error) : resolve(selected));
    });
  });
}

async function selectLocalPort({ preferredPort = 3000, probe = probeLocalPort } = {}) {
  if (preferredPort !== null) {
    for (let port = preferredPort; port < preferredPort + 20; port++) {
      try { return await probe(port); }
      catch (error) { if (!["EACCES", "EADDRINUSE"].includes(error.code)) throw error; }
    }
  }
  // Windows can reserve whole contiguous ranges. Let the OS choose outside them.
  try { return await probe(0); }
  catch (error) {
    throw new Error(`无法启动本地服务：系统未能分配可用的回环端口（${error.code || error.message}）。请检查本机网络权限后重试。`, { cause: error });
  }
}

module.exports = { probeLocalPort, selectLocalPort };
