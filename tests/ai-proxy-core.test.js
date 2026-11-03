const assert = require("node:assert/strict");
const test = require("node:test");
const { normalizeAiProxy, validateAiProxy, manualProxyUrl, bypassProxy, normalizeProxyUrl, systemProxyUrl } = require("../lib/ai-proxy-core");
const { normalizeSettings, mergeAiSettings, publicAiSettings } = require("../lib/ai-settings-core");
const { systemProxyUrls } = require("../lib/ai-proxy-core");

test("system proxy candidates retain order and only include an explicit DIRECT fallback", () => {
  assert.deepEqual(systemProxyUrls("PROXY first.test:80; HTTPS second.test:443"), ["http://first.test/", "https://second.test/"]);
  assert.deepEqual(systemProxyUrls("PROXY first.test:80; DIRECT; PROXY unused.test:80"), ["http://first.test/", ""]);
});

test("bypass rules support literal IPv4 and IPv6 CIDR ranges without DNS lookups", () => {
  for (const [url, cidr, expected] of [
    ["http://192.168.7.2/v1", "192.168.0.0/16", true],
    ["http://192.169.7.2/v1", "192.168.0.0/16", false],
    ["http://127.0.0.1/v1", "127.0.0.1/32", true],
    ["http://[fd00::1234]/v1", "fd00::/8", true],
    ["http://[fe80::1]/v1", "fd00::/8", false],
    ["http://[::1]/v1", "::1/128", true],
    ["http://[::ffff:127.0.0.1]/v1", "::ffff:127.0.0.0/120", true],
    ["http://example.test/v1", "0.0.0.0/0", false],
    ["http://127.0.0.1/v1", "0.0.0.0/33", false]
  ]) assert.equal(bypassProxy(url, cidr), expected, `${url}: ${cidr}`);
});

test("proxy drafts preserve credentials across provider switches and redact public settings", () => {
  const current = normalizeSettings({ proxy: { mode: "manual", protocol: "socks5", host: "proxy.example.com", port: "1081", username: "collector", password: "proxy-secret" } });
  const switched = mergeAiSettings(current, { provider: "deepseek", proxy: { password: undefined } });
  assert.equal(switched.proxy.password, "proxy-secret");
  assert.equal(publicAiSettings(switched).proxy.hasPassword, true);
  assert.equal(JSON.stringify(publicAiSettings(switched)).includes("proxy-secret"), false);
  assert.equal(mergeAiSettings(switched, { proxy: { password: "" } }).proxy.password, "");
  assert.equal(normalizeAiProxy().mode, "auto");
  assert.equal(normalizeAiProxy().port, "");
});
test("manual proxy accepts remote hosts and encodes authentication separately", () => {
  const proxy = normalizeAiProxy({ mode: "manual", protocol: "https", host: "gateway.example.com", port: "9443", username: "a@b%", password: "p:/@%密" });
  const url = new URL(manualProxyUrl(proxy));
  assert.equal(url.hostname, "gateway.example.com");
  assert.equal(url.port, "9443");
  assert.equal(decodeURIComponent(url.username), "a@b%");
  assert.equal(decodeURIComponent(url.password), "p:/@%密");
  for (const host of ["http://user:secret@proxy", "proxy/path", "proxy?x=1"]) assert.throws(() => validateAiProxy(normalizeAiProxy({ ...proxy, host })));
  for (const port of ["0", "65536", "wrong", ""]) assert.throws(() => validateAiProxy(normalizeAiProxy({ ...proxy, port })));
});
test("proxy bypass supports local IPv6, suffix rules and explicit ports", () => {
  assert.equal(bypassProxy("http://[::1]:11434/v1", "localhost,127.0.0.1,::1"), true);
  assert.equal(bypassProxy("https://api.example.com/v1", ".example.com"), true);
  assert.equal(bypassProxy("https://example.com/v1", "*.example.com"), false);
  assert.equal(bypassProxy("https://api.example.com:8443/v1", "api.example.com:443"), false);
  assert.equal(bypassProxy("https://api.example.com:8443/v1", "api.example.com:8443"), true);
  assert.equal(bypassProxy("https://api.openai.com/v1", "localhost"), false);
});
test("system and environment proxy parsing accepts supported protocols without exposing invalid credentials", () => {
  assert.equal(systemProxyUrl("PROXY gateway.example.com:8080; DIRECT"), "http://gateway.example.com:8080/");
  assert.equal(systemProxyUrl("DIRECT"), "");
  assert.equal(new URL(systemProxyUrl("SOCKS5 gateway.example.com:1090")).protocol, "socks5:");
  assert.throws(() => systemProxyUrl("SOCKS gateway.example.com:1090; DIRECT"), /系统代理类型不受支持/);
  assert.throws(() => systemProxyUrl("SOCKS4 gateway.example.com:1090; DIRECT"), /系统代理类型不受支持/);
  assert.equal(new URL(normalizeProxyUrl("socks5h://gateway.example.com:1090")).protocol, "socks5:");
  assert.throws(() => normalizeProxyUrl("file://user:secret@host"), error => !error.message.includes("secret"));
});
